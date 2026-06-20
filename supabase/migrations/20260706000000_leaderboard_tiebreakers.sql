-- Tie-breakers for the leaderboard.
--
-- When two users end up with the same points after a gala (or season), the
-- ranking is decided in this order:
--   1. points (unchanged)
--   2. fights_correct_winner — picking more winners right is the core skill
--      of the game, even if the exact method/round was missed, so it
--      outranks someone who scored the same points from fewer correct
--      winners plus lucky method/round bonuses.
--   3. perfect_card — nailing the whole card is still worth more than not,
--      even on the rare occasion it doesn't already separate the points.
--   4. earliest_prediction_at — whoever locked in their predictions first
--      gets the edge. This rewards genuine prediction over waiting for
--      odds/news to shift before tipping, which is the only "skill" left
--      to differentiate by once the above are equal.

create or replace view public.event_leaderboard as
with regular as (
  select
    f.event_id,
    pr.user_id,
    sum(pr.points) as points,
    count(pr.points) as fights_scored,
    count(*) filter (where pr.points >= 1) as fights_correct_winner,
    min(pr.created_at) as earliest_prediction_at
  from public.predictions pr
  join public.fights f on f.id = pr.fight_id
  group by f.event_id, pr.user_id
),
bonus as (
  select event_id, user_id, points, created_at from public.bonus_predictions
),
event_totals as (
  select
    event_id,
    count(*) as total_fights,
    count(*) filter (where status = 'completed') as fights_completed
  from public.fights
  group by event_id
),
joined as (
  select
    coalesce(regular.event_id, bonus.event_id) as event_id,
    coalesce(regular.user_id, bonus.user_id) as user_id,
    coalesce(regular.points, 0) as regular_points,
    coalesce(bonus.points, 0) as bonus_points,
    coalesce(regular.fights_scored, 0) as fights_scored,
    coalesce(regular.fights_correct_winner, 0) as fights_correct_winner,
    least(regular.earliest_prediction_at, bonus.created_at) as earliest_prediction_at
  from regular
  full outer join bonus on bonus.event_id = regular.event_id and bonus.user_id = regular.user_id
)
select
  joined.event_id,
  joined.user_id,
  p.nickname,
  joined.regular_points + joined.bonus_points
    + case
        when et.total_fights > 0
         and et.fights_completed = et.total_fights
         and joined.fights_scored = et.total_fights
         and joined.fights_correct_winner = et.total_fights
        then 5
        else 0
      end as points,
  joined.fights_scored,
  et.fights_completed,
  (
    et.total_fights > 0
    and et.fights_completed = et.total_fights
    and joined.fights_scored = et.total_fights
    and joined.fights_correct_winner = et.total_fights
  ) as perfect_card,
  joined.fights_correct_winner,
  joined.earliest_prediction_at
from joined
join public.profiles p on p.id = joined.user_id
join event_totals et on et.event_id = joined.event_id;

create or replace view public.season_leaderboard as
select
  extract(year from e.event_date)::int as season,
  el.user_id,
  el.nickname,
  sum(el.points)::bigint as points,
  sum(el.fights_correct_winner)::bigint as fights_correct_winner,
  count(*) filter (where el.perfect_card) as perfect_cards,
  min(el.earliest_prediction_at) as earliest_prediction_at
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
  sl.earliest_prediction_at
from public.group_members gm
join public.groups g on g.id = gm.group_id
join public.season_leaderboard sl on sl.user_id = gm.user_id;
