-- Perfect card bonus: +5 points if a user correctly picked the winner
-- of every fight on a fully completed event card (and predicted on all
-- of them - skipping a fight disqualifies the bonus). Computed straight
-- from predictions/fights rather than stored, since it's fully
-- deterministic once an event is completed.

create or replace view public.event_leaderboard as
with regular as (
  select
    f.event_id,
    pr.user_id,
    sum(pr.points) as points,
    count(pr.points) as fights_scored,
    count(*) filter (where pr.points >= 1) as fights_correct_winner
  from public.predictions pr
  join public.fights f on f.id = pr.fight_id
  group by f.event_id, pr.user_id
),
bonus as (
  select event_id, user_id, points from public.bonus_predictions
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
    coalesce(regular.fights_correct_winner, 0) as fights_correct_winner
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
  ) as perfect_card
from joined
join public.profiles p on p.id = joined.user_id
join event_totals et on et.event_id = joined.event_id;

create or replace view public.season_leaderboard as
select
  extract(year from e.event_date)::int as season,
  el.user_id,
  el.nickname,
  sum(el.points) as points
from public.event_leaderboard el
join public.events e on e.id = el.event_id
group by season, el.user_id, el.nickname;
