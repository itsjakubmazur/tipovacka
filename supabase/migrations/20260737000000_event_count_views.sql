-- The galas list used to fetch *every fight of every gala* and every one of
-- the viewer's predictions, then count them in JavaScript. PostgREST caps a
-- response at 1000 rows, so at ~11 fights per card that quietly starts
-- truncating around the 90th gala and the "Tipnuto 7 z 11" counters begin to
-- lie. These two views do the counting in the database, which returns one row
-- per gala instead.
--
-- security_invoker: the views run with the caller's permissions, so the
-- predictions RLS still applies - nobody can count someone else's tips before
-- the deadline.

-- Fights that actually count towards a card, i.e. what "z 11 zápasů" means.
create view public.event_fight_counts
with (security_invoker = on) as
select
  event_id,
  count(*)::int as fight_count
from public.fights
where status not in ('cancelled', 'no_contest')
group by event_id;

-- How many of them each tipper has covered.
create view public.event_user_tip_counts
with (security_invoker = on) as
select
  f.event_id,
  p.user_id,
  count(*)::int as tipped
from public.predictions p
join public.fights f on f.id = p.fight_id
where f.status not in ('cancelled', 'no_contest')
group by f.event_id, p.user_id;

grant select on public.event_fight_counts to authenticated;
grant select on public.event_user_tip_counts to authenticated;
