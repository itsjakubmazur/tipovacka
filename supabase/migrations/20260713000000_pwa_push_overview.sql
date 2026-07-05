-- Superadmin overview of who actually installed the PWA and has push
-- subscriptions.
--
-- PWA install isn't directly observable server-side, so the app pings
-- profiles.standalone_seen_at whenever it starts in standalone display
-- mode (i.e. launched from the home-screen icon) - see the
-- StandalonePing component. A recent timestamp = actively using the
-- installed app.
alter table public.profiles
  add column if not exists standalone_seen_at timestamptz;

-- admin_list_profiles grows two fields: the standalone ping and each
-- user's push endpoints (the endpoint host identifies the platform -
-- web.push.apple.com = iPhone/iPad, fcm.googleapis.com = Android/Chrome,
-- ...mozilla.com = Firefox). Return type changes, so drop + recreate.
drop function if exists public.admin_list_profiles();

create function public.admin_list_profiles()
returns table (
  id uuid,
  nickname text,
  is_admin boolean,
  email text,
  standalone_seen_at timestamptz,
  push_endpoints text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles caller where caller.id = auth.uid() and caller.is_superadmin) then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id,
    p.nickname,
    p.is_admin,
    u.email::text,
    p.standalone_seen_at,
    coalesce(
      (select array_agg(ps.endpoint) from public.push_subscriptions ps where ps.user_id = p.id),
      '{}'::text[]
    )
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.nickname;
end;
$$;
