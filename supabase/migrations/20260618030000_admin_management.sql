-- Allow an existing admin to promote/demote OTHER users to admin through
-- a security-definer RPC, while keeping the existing protection that
-- blocks users from changing is_admin on their own row via a normal
-- UPDATE. The protect_is_admin trigger only lets is_admin changes
-- through when the transaction-local app.admin_override flag is set,
-- which only admin_set_user_admin() below sets (and only after
-- checking the caller is an admin).
create or replace function public.protect_is_admin()
returns trigger as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.role() = 'authenticated'
     and coalesce(current_setting('app.admin_override', true), '') <> 'on' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_set_user_admin(target_user_id uuid, new_is_admin boolean)
returns void as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only admins can change admin status';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Cannot change your own admin status';
  end if;

  perform set_config('app.admin_override', 'on', true);
  update public.profiles set is_admin = new_is_admin where id = target_user_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;
