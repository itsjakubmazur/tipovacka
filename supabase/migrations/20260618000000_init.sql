-- OKTAGON Tipovačka — initial schema, scoring, views, RLS

create extension if not exists pgcrypto;

-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent regular logged-in users from promoting themselves to admin
-- via a normal UPDATE through the API (service_role / SQL editor bypass this).
create function public.protect_is_admin()
returns trigger as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.role() = 'authenticated' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger protect_profiles_is_admin
  before update on public.profiles
  for each row execute function public.protect_is_admin();

-- =========================================================
-- EVENTS (galavečery)
-- =========================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  number integer,
  name text not null,
  event_date timestamptz not null,
  location text,
  sherdog_event_url text,
  lock_at timestamptz,
  auto_lock boolean not null default true,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'locked', 'completed')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- FIGHTERS
-- =========================================================
create table public.fighters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  photo_url text,
  sherdog_slug text unique,
  created_at timestamptz not null default now()
);

-- =========================================================
-- FIGHTS
-- =========================================================
create table public.fights (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  fighter_a_id uuid not null references public.fighters(id),
  fighter_b_id uuid not null references public.fighters(id),
  weight_class text,
  is_title_fight boolean not null default false,
  is_main_event boolean not null default false,
  card_order integer not null default 0,
  rounds integer not null default 3,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_contest')),
  winner_fighter_id uuid references public.fighters(id),
  method text check (method in ('KO/TKO', 'SUBMISSION', 'DECISION')),
  result_round integer,
  created_at timestamptz not null default now(),
  check (fighter_a_id <> fighter_b_id)
);

create index fights_event_id_idx on public.fights(event_id);

-- =========================================================
-- PREDICTIONS
-- =========================================================
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fight_id uuid not null references public.fights(id) on delete cascade,
  predicted_winner_id uuid not null references public.fighters(id),
  predicted_method text not null check (predicted_method in ('KO/TKO', 'SUBMISSION', 'DECISION')),
  -- NULL predicted_round means "na body" and is only valid together with DECISION
  predicted_round integer,
  points integer, -- NULL = not graded yet / voided fight, 0-3 = graded
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fight_id),
  check (
    (predicted_method = 'DECISION' and predicted_round is null)
    or (predicted_method <> 'DECISION' and predicted_round is not null)
  )
);

create index predictions_fight_id_idx on public.predictions(fight_id);
create index predictions_user_id_idx on public.predictions(user_id);

create function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger predictions_set_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();

-- =========================================================
-- SCORING
-- =========================================================
-- Winner: +1. Method: +1 (only if winner correct). Round: +1 (only if
-- winner correct); for a DECISION result, the correct "round" tip is
-- predicted_round IS NULL ("na body").
create function public.calculate_points(
  p_predicted_winner uuid,
  p_predicted_method text,
  p_predicted_round integer,
  p_actual_winner uuid,
  p_actual_method text,
  p_actual_round integer
) returns integer as $$
declare
  pts integer := 0;
begin
  if p_predicted_winner <> p_actual_winner then
    return 0;
  end if;

  pts := pts + 1; -- correct winner

  if p_predicted_method = p_actual_method then
    pts := pts + 1;
  end if;

  if p_actual_method = 'DECISION' then
    if p_predicted_round is null then
      pts := pts + 1;
    end if;
  elsif p_predicted_round = p_actual_round then
    pts := pts + 1;
  end if;

  return pts;
end;
$$ language plpgsql immutable;

-- Recompute predictions.points for every fight of one event. Completed
-- fights get graded; cancelled/no_contest/scheduled fights are voided
-- (points = NULL, excluded from SUM in the leaderboard views).
create function public.recalculate_event_points(p_event_id uuid)
returns void as $$
begin
  update public.predictions pr
  set points = case
    when f.status = 'completed' then
      public.calculate_points(
        pr.predicted_winner_id, pr.predicted_method, pr.predicted_round,
        f.winner_fighter_id, f.method, f.result_round
      )
    else null
  end
  from public.fights f
  where f.id = pr.fight_id
    and f.event_id = p_event_id;
end;
$$ language plpgsql security definer set search_path = public;

-- =========================================================
-- LEADERBOARD VIEWS
-- =========================================================
create view public.event_leaderboard as
select
  f.event_id,
  pr.user_id,
  p.nickname,
  coalesce(sum(pr.points), 0) as points,
  count(pr.points) as fights_scored,
  (
    select count(*) from public.fights f2
    where f2.event_id = f.event_id and f2.status = 'completed'
  ) as fights_completed
from public.predictions pr
join public.fights f on f.id = pr.fight_id
join public.profiles p on p.id = pr.user_id
group by f.event_id, pr.user_id, p.nickname;

create view public.season_leaderboard as
select
  extract(year from e.event_date)::int as season,
  pr.user_id,
  p.nickname,
  coalesce(sum(pr.points), 0) as points
from public.predictions pr
join public.fights f on f.id = pr.fight_id
join public.events e on e.id = f.event_id
join public.profiles p on p.id = pr.user_id
group by season, pr.user_id, p.nickname;

grant select on public.event_leaderboard to anon, authenticated;
grant select on public.season_leaderboard to anon, authenticated;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.fighters enable row level security;
alter table public.fights enable row level security;
alter table public.predictions enable row level security;

-- profiles: nicknames are public (needed for leaderboards); users can
-- only edit their own row, and can never flip is_admin themselves
-- (enforced by the protect_is_admin trigger above).
create policy profiles_select_all on public.profiles
  for select using (true);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- events / fighters / fights: readable by everyone, writable only by
-- admins (service_role used by the scraper bypasses RLS entirely).
create policy events_select_all on public.events
  for select using (true);

create policy events_admin_write on public.events
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

create policy fighters_select_all on public.fighters
  for select using (true);

create policy fighters_admin_write on public.fighters
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

create policy fights_select_all on public.fights
  for select using (true);

create policy fights_admin_write on public.fights
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- predictions: everyone can see their own tips at any time; other
-- people's tips only become visible once the event is locked/completed,
-- so nobody can copy a tip before the deadline. Tips can only be
-- created/changed by their owner, and only while the event is unlocked.
create policy predictions_select_own on public.predictions
  for select using (auth.uid() = user_id);

create policy predictions_select_after_lock on public.predictions
  for select using (
    exists (
      select 1 from public.fights f
      join public.events e on e.id = f.event_id
      where f.id = predictions.fight_id
        and (e.status = 'completed' or (e.lock_at is not null and now() >= e.lock_at))
    )
  );

create policy predictions_insert_own on public.predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fights f
      join public.events e on e.id = f.event_id
      where f.id = predictions.fight_id
        and e.status <> 'completed'
        and (e.lock_at is null or now() < e.lock_at)
    )
  );

create policy predictions_update_own on public.predictions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fights f
      join public.events e on e.id = f.event_id
      where f.id = predictions.fight_id
        and e.status <> 'completed'
        and (e.lock_at is null or now() < e.lock_at)
    )
  );
