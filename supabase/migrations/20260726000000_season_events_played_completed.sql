-- events_played should mean "galas that have actually been played and
-- evaluated", not every event the tipper has a row for - a future or
-- still-hidden (draft) gala an admin pre-tipped was inflating the
-- count. Restrict it to completed events. Points/tiebreaks are
-- unaffected (non-completed events contribute 0 points anyway).
create or replace view public.season_leaderboard as
select
  extract(year from e.event_date)::int as season,
  el.user_id,
  el.nickname,
  sum(el.points)::bigint as points,
  sum(el.fights_correct_winner)::bigint as fights_correct_winner,
  count(*) filter (where el.perfect_card) as perfect_cards,
  min(el.earliest_prediction_at) as earliest_prediction_at,
  (count(*) filter (where e.status = 'completed'))::int as events_played
from public.event_leaderboard el
join public.events e on e.id = el.event_id
group by season, el.user_id, el.nickname;
