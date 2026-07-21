-- Invite-code gate on registration. The app is a private friends-group
-- game with real money in the startovné pool - if the URL ever leaks,
-- open registration would let anyone in. One shared code for the whole
-- group, rotatable by a superadmin at any time (existing accounts are
-- untouched by a rotation).
--
-- Enforcement lives in the handle_new_user trigger, not just the form:
-- signUp sends the code in user metadata, and the trigger rejects the
-- auth.users insert outright when it doesn't match - so calling the
-- Supabase API directly with the anon key can't get around it.
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- intentionally no policies: readable/writable only via the security
-- definer functions below (and service_role).

insert into public.app_settings (key, value)
values ('invite_code', 'GARAZ-' || upper(substr(md5(random()::text), 1, 8)));

create or replace function public.handle_new_user()
returns trigger as $$
declare
  expected text;
begin
  select value into expected from public.app_settings where key = 'invite_code';
  if expected is not null
     and coalesce(new.raw_user_meta_data->>'invite_code', '') <> expected then
    raise exception 'invalid invite code';
  end if;

  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Friendly pre-check for the registration form, so a typo'd code shows
-- a clear Czech error instead of signUp's generic database failure.
-- The trigger above stays the actual gate.
create or replace function public.check_invite_code(code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_settings where key = 'invite_code' and value = code
  );
$$;

grant execute on function public.check_invite_code(text) to anon, authenticated;

create or replace function public.admin_get_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin) then
    raise exception 'not authorized';
  end if;
  return (select value from public.app_settings where key = 'invite_code');
end;
$$;

create or replace function public.admin_set_invite_code(new_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin) then
    raise exception 'not authorized';
  end if;
  if length(trim(new_code)) < 6 then
    raise exception 'invite code too short';
  end if;
  update public.app_settings
  set value = trim(new_code), updated_at = now()
  where key = 'invite_code';
end;
$$;

grant execute on function public.admin_get_invite_code() to authenticated;
grant execute on function public.admin_set_invite_code(text) to authenticated;
