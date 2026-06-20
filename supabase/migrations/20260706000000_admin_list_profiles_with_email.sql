-- Admin-only RPC exposing each user's registration email alongside their
-- profile. The email lives in auth.users, which isn't readable by the
-- anon/authenticated roles, so we read it inside a security definer
-- function instead of adding an email column to the publicly-readable
-- profiles table.
create or replace function public.admin_list_profiles()
returns table (id uuid, nickname text, is_admin boolean, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  return query
  select p.id, p.nickname, p.is_admin, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.nickname;
end;
$$;

grant execute on function public.admin_list_profiles() to authenticated;
