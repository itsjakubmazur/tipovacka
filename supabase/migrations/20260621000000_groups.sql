-- Private groups (skupiny) - a user can create a group and share an
-- invite code with friends; the group's own leaderboard only sums
-- points for its members. Groups are intentionally NOT readable by
-- everyone (unlike events/fighters/fights) - the only way to discover
-- a group is to already know its invite code, enforced by routing
-- both creation and joining through security-definer RPCs instead of
-- plain inserts.
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members(user_id);

create function public.generate_invite_code()
returns text as $$
declare
  code text;
begin
  loop
    code := upper(substr(md5(random()::text), 1, 6));
    if not exists (select 1 from public.groups where invite_code = code) then
      return code;
    end if;
  end loop;
end;
$$ language plpgsql;

create function public.create_group(p_name text)
returns table (id uuid, invite_code text) as $$
declare
  v_id uuid;
  v_code text;
begin
  v_code := public.generate_invite_code();
  insert into public.groups (name, invite_code, created_by)
  values (p_name, v_code, auth.uid())
  returning groups.id into v_id;

  insert into public.group_members (group_id, user_id) values (v_id, auth.uid());

  return query select v_id, v_code;
end;
$$ language plpgsql security definer set search_path = public;

create function public.join_group(p_invite_code text)
returns uuid as $$
declare
  v_group_id uuid;
begin
  select groups.id into v_group_id from public.groups where invite_code = upper(p_invite_code);
  if v_group_id is null then
    raise exception 'Neplatný kód skupiny';
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, auth.uid())
  on conflict do nothing;

  return v_group_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;

create view public.group_season_leaderboard as
select
  gm.group_id,
  g.name as group_name,
  sl.season,
  sl.user_id,
  sl.nickname,
  sl.points
from public.group_members gm
join public.groups g on g.id = gm.group_id
join public.season_leaderboard sl on sl.user_id = gm.user_id;

grant select on public.group_season_leaderboard to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- groups: only visible to members; creation/joining only via the RPCs
-- above (no insert policy needed since those run security definer).
create policy groups_select_member on public.groups
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.user_id = auth.uid()
    )
  );

-- group_members: a member can see the membership rows of any group
-- they themselves belong to (i.e. their fellow members), but nothing
-- about groups they're not in.
create policy group_members_select on public.group_members
  for select using (
    user_id = auth.uid()
    or group_id in (select gm2.group_id from public.group_members gm2 where gm2.user_id = auth.uid())
  );

create policy group_members_delete_own on public.group_members
  for delete using (user_id = auth.uid());
