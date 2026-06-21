-- Superadmin: a second, more privileged tier above is_admin, for the
-- handful of admin surfaces that shouldn't be handed to a regular admin
-- (scraper log, manual broadcast push, full user list with emails).
-- There's deliberately no UI/RPC to grant this - unlike is_admin (set
-- via admin_set_user_admin), is_superadmin can only ever be flipped by
-- running SQL directly against the database (Supabase SQL editor /
-- service role), which runs outside the 'authenticated' role the guard
-- trigger below checks for.
alter table public.profiles
  add column is_superadmin boolean not null default false;

create or replace function public.protect_is_admin()
returns trigger as $$
begin
  if auth.role() = 'authenticated' then
    if new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
    if new.is_superadmin is distinct from old.is_superadmin then
      new.is_superadmin := old.is_superadmin;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- The scraper log is sensitive enough (full run history, error
-- messages) to restrict to superadmins only, not every admin.
drop policy scraper_runs_select_admin on public.scraper_runs;

create policy scraper_runs_select_superadmin on public.scraper_runs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_superadmin)
  );

-- The full user list (with emails) is also superadmin-only.
create or replace function public.admin_list_profiles()
returns table (id uuid, nickname text, is_admin boolean, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles caller where caller.id = auth.uid() and caller.is_superadmin) then
    raise exception 'not authorized';
  end if;

  return query
  select p.id, p.nickname, p.is_admin, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.nickname;
end;
$$;
