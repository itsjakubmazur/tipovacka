-- Bonus tip: pick which fight will be Fight of the Night, worth +2
-- points if right. Mirrors the predictions table's own-row/lock-window
-- RLS pattern. The leaderboard views are rewritten with CTEs so the
-- bonus total only gets counted once per (event, user) regardless of
-- how many regular fight picks that user made - a plain LEFT JOIN
-- would have worked too here since bonus is unique per (event, user),
-- but the CTE keeps event/season totals correct even when someone has
-- a bonus pick but zero regular picks for that event.

alter table public.events
  add column actual_fotn_fight_id uuid references public.fights(id);

create table public.bonus_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  predicted_fotn_fight_id uuid not null references public.fights(id),
  points integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index bonus_predictions_event_id_idx on public.bonus_predictions(event_id);

create trigger bonus_predictions_set_updated_at
  before update on public.bonus_predictions
  for each row execute function public.set_updated_at();

create function public.recalculate_bonus_points(p_event_id uuid)
returns void as $$
begin
  update public.bonus_predictions bp
  set points = case
    when e.actual_fotn_fight_id is null then null
    when bp.predicted_fotn_fight_id = e.actual_fotn_fight_id then 2
    else 0
  end
  from public.events e
  where e.id = p_event_id and bp.event_id = p_event_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.recalculate_bonus_points(uuid) to authenticated;

alter table public.bonus_predictions enable row level security;

create policy bonus_predictions_select_own on public.bonus_predictions
  for select using (auth.uid() = user_id);

create policy bonus_predictions_select_after_lock on public.bonus_predictions
  for select using (
    exists (
      select 1 from public.events e
      where e.id = bonus_predictions.event_id
        and (e.status = 'completed' or (e.lock_at is not null and now() >= e.lock_at))
    )
  );

create policy bonus_predictions_insert_own on public.bonus_predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = bonus_predictions.event_id
        and e.status <> 'completed'
        and (e.lock_at is null or now() < e.lock_at)
    )
  );

create policy bonus_predictions_update_own on public.bonus_predictions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = bonus_predictions.event_id
        and e.status <> 'completed'
        and (e.lock_at is null or now() < e.lock_at)
    )
  );

-- =========================================================
-- LEADERBOARD VIEWS - now include bonus points
-- =========================================================
create or replace view public.event_leaderboard as
with regular as (
  select f.event_id, pr.user_id, sum(pr.points) as points, count(pr.points) as fights_scored
  from public.predictions pr
  join public.fights f on f.id = pr.fight_id
  group by f.event_id, pr.user_id
),
bonus as (
  select event_id, user_id, points from public.bonus_predictions
)
select
  coalesce(regular.event_id, bonus.event_id) as event_id,
  coalesce(regular.user_id, bonus.user_id) as user_id,
  p.nickname,
  coalesce(regular.points, 0) + coalesce(bonus.points, 0) as points,
  coalesce(regular.fights_scored, 0) as fights_scored,
  (
    select count(*) from public.fights f2
    where f2.event_id = coalesce(regular.event_id, bonus.event_id) and f2.status = 'completed'
  ) as fights_completed
from regular
full outer join bonus on bonus.event_id = regular.event_id and bonus.user_id = regular.user_id
join public.profiles p on p.id = coalesce(regular.user_id, bonus.user_id);

create or replace view public.season_leaderboard as
with regular as (
  select extract(year from e.event_date)::int as season, pr.user_id, sum(pr.points) as points
  from public.predictions pr
  join public.fights f on f.id = pr.fight_id
  join public.events e on e.id = f.event_id
  group by season, pr.user_id
),
bonus as (
  select extract(year from e.event_date)::int as season, bp.user_id, sum(bp.points) as points
  from public.bonus_predictions bp
  join public.events e on e.id = bp.event_id
  group by season, bp.user_id
)
select
  coalesce(regular.season, bonus.season) as season,
  coalesce(regular.user_id, bonus.user_id) as user_id,
  p.nickname,
  coalesce(regular.points, 0) + coalesce(bonus.points, 0) as points
from regular
full outer join bonus on bonus.season = regular.season and bonus.user_id = regular.user_id
join public.profiles p on p.id = coalesce(regular.user_id, bonus.user_id);
