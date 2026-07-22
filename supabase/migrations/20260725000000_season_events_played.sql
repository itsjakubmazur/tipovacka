-- Add "how many galas did this tipper play" to the season standings.
-- Each event_leaderboard row is one tipper in one event (they only
-- appear if they tipped it), so a plain count over the season grouping
-- is exactly the number of galas they took part in.
create or replace view public.season_leaderboard as
select
  extract(year from e.event_date)::int as season,
  el.user_id,
  el.nickname,
  sum(el.points)::bigint as points,
  sum(el.fights_correct_winner)::bigint as fights_correct_winner,
  count(*) filter (where el.perfect_card) as perfect_cards,
  min(el.earliest_prediction_at) as earliest_prediction_at,
  count(*)::int as events_played
from public.event_leaderboard el
join public.events e on e.id = el.event_id
group by season, el.user_id, el.nickname;

create or replace view public.group_season_leaderboard as
select
  gm.group_id,
  g.name as group_name,
  sl.season,
  sl.user_id,
  sl.nickname,
  sl.points,
  sl.fights_correct_winner,
  sl.perfect_cards,
  sl.earliest_prediction_at,
  sl.events_played
from public.group_members gm
join public.groups g on g.id = gm.group_id
join public.season_leaderboard sl on sl.user_id = gm.user_id;
