-- The OUT parameters of admin_list_profiles (id, nickname, is_admin,
-- email) shadow the identically-named columns inside the function body,
-- which made "where id = auth.uid()" ambiguous. Qualify with a table
-- alias instead.
create or replace function public.admin_list_profiles()
returns table (id uuid, nickname text, is_admin boolean, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles caller where caller.id = auth.uid() and caller.is_admin) then
    raise exception 'not authorized';
  end if;

  return query
  select p.id, p.nickname, p.is_admin, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.nickname;
end;
$$;
