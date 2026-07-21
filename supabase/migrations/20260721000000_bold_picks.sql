-- Bold pick ("jistotka"): each user can mark exactly one fight per
-- event as their double-or-nothing pick - whatever points that fight's
-- prediction earns count twice in the event leaderboard. Same
-- visibility/lock rules as predictions: your own always, other
-- people's only after lock, changes only while the event is unlocked.
create table public.bold_picks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  fight_id uuid not null references public.fights(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index bold_picks_event_idx on public.bold_picks(event_id);

alter table public.bold_picks enable row level security;

create policy bold_picks_select_own on public.bold_picks
  for select using (auth.uid() = user_id);

create policy bold_picks_select_after_lock on public.bold_picks
  for select using (
    exists (
      select 1 from public.events e
      where e.id = bold_picks.event_id
        and (e.status = 'completed' or (e.lock_at is not null and now() >= e.lock_at))
    )
  );

create policy bold_picks_insert_own on public.bold_picks
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = bold_picks.event_id
        and e.status <> 'completed'
        and (e.lock_at is null or now() < e.lock_at)
    )
  );

create policy bold_picks_update_own on public.bold_picks
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = bold_picks.event_id
        and e.status <> 'completed'
        and (e.lock_at is null or now() < e.lock_at)
    )
  );

create policy bold_picks_delete_own on public.bold_picks
  for delete using (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = bold_picks.event_id
        and e.status <> 'completed'
        and (e.lock_at is null or now() < e.lock_at)
    )
  );

-- event_leaderboard: points on the bold fight count double. The
-- multiplier applies only to the per-fight prediction points - the
-- FOTN bonus and the perfect-card +5 stay single. fights_correct_winner
-- and the perfect-card conditions are intentionally left unmultiplied.
create or replace view public.event_leaderboard as
with regular as (
  select
    f.event_id,
    pr.user_id,
    sum(pr.points * case when bp.id is not null then 2 else 1 end) as points,
    count(pr.points) as fights_scored,
    count(*) filter (where pr.points >= 1) as fights_correct_winner,
    min(pr.created_at) as earliest_prediction_at
  from public.predictions pr
  join public.fights f on f.id = pr.fight_id
  left join public.bold_picks bp
    on bp.fight_id = pr.fight_id and bp.user_id = pr.user_id
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

-- Live updates for the bold-pick toggle.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bold_picks'
  ) then
    alter publication supabase_realtime add table public.bold_picks;
  end if;
end $$;
