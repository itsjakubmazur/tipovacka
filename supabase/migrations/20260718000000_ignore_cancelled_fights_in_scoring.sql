-- A cancelled or no-contest fight never has a real result to predict,
-- so it must be treated as if it never existed on the card at all -
-- not "impossible to complete" (which silently blocked the perfect-card
-- bonus for everyone) and not "still a tip that counts towards
-- startovné" (which could inflate the pool for someone whose only pick
-- was on that fight). Both event_leaderboard's regular CTE and
-- event_totals now simply exclude those fights from the join/count.
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
  where f.status not in ('cancelled', 'no_contest')
  group by f.event_id, pr.user_id
),
bonus as (
  select event_id, user_id, points, created_at from public.bonus_predictions
),
event_totals as (
  select
    event_id,
    count(*) filter (where status not in ('cancelled', 'no_contest')) as total_fights,
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
