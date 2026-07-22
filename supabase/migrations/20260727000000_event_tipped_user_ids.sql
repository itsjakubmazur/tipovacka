-- Who has tipped a given event, as a bare set of user ids. Needed for
-- the pre-lock "who hasn't tipped yet" nudge: before lock, RLS hides
-- other people's predictions entirely, so the app can't tell who has
-- tipped. This security-definer function exposes only participation
-- (the user ids), never the picks themselves, so it stays privacy-safe.
create or replace function public.event_tipped_user_ids(p_event_id uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select distinct pr.user_id
  from public.predictions pr
  join public.fights f on f.id = pr.fight_id
  where f.event_id = p_event_id;
$$;

grant execute on function public.event_tipped_user_ids(uuid) to authenticated;
