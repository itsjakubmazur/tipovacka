-- Integrity and privacy: bank accounts off the public profile row, clients
-- cannot write prediction points, admin promote works again, leaderboard
-- views run as the caller, invite code is not an anon oracle.

-- =========================================================
-- Bank accounts: own-row table + RPC for the gala winner
-- =========================================================
create table public.profile_bank_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bank_account text not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_bank_accounts enable row level security;

grant select, insert, update, delete on public.profile_bank_accounts to authenticated;

create policy pba_select_own on public.profile_bank_accounts
  for select using (auth.uid() = user_id);

create policy pba_insert_own on public.profile_bank_accounts
  for insert with check (auth.uid() = user_id);

create policy pba_update_own on public.profile_bank_accounts
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy pba_delete_own on public.profile_bank_accounts
  for delete using (auth.uid() = user_id);

insert into public.profile_bank_accounts (user_id, bank_account)
select id, bank_account from public.profiles
where bank_account is not null and length(trim(bank_account)) > 0;

alter table public.profiles drop column if exists bank_account;

-- Winner's account for a completed, payouts-enabled gala. Losers need it
-- for the QR; they must not be able to dump every account via REST.
create function public.event_winner_bank_account(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  acct text;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select pba.bank_account into acct
  from public.event_leaderboard el
  join public.events e on e.id = el.event_id
  left join public.profile_bank_accounts pba on pba.user_id = el.user_id
  where el.event_id = p_event_id
    and e.status = 'completed'
    and e.payouts_enabled
  order by
    el.points desc,
    el.fights_correct_winner desc,
    el.perfect_card desc,
    el.earliest_prediction_at asc nulls last
  limit 1;

  return acct;
end;
$$;

grant execute on function public.event_winner_bank_account(uuid) to authenticated;

-- Nicknames stay readable to the logged-in party; anon REST cannot
-- list profiles at all (the previous USING (true) policy applied to anon).
drop policy if exists profiles_select_all on public.profiles;

create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (true);

-- =========================================================
-- Clients cannot grade their own tips
-- =========================================================
revoke insert, update on public.predictions from anon, authenticated, public;
grant select, delete on public.predictions to authenticated;
grant insert (
  id, user_id, fight_id, predicted_winner_id, predicted_method, predicted_round, created_at, updated_at
) on public.predictions to authenticated;
-- Upsert from the JS client SETs user_id/fight_id even when they are unchanged.
grant update (
  user_id, fight_id, predicted_winner_id, predicted_method, predicted_round, updated_at
) on public.predictions to authenticated;

revoke insert, update on public.bonus_predictions from anon, authenticated, public;
grant select, delete on public.bonus_predictions to authenticated;
grant insert (
  id, user_id, event_id, predicted_fotn_fight_id, created_at, updated_at
) on public.bonus_predictions to authenticated;
grant update (
  user_id, event_id, predicted_fotn_fight_id, updated_at
) on public.bonus_predictions to authenticated;

create function public.predictions_immutable_keys()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.fight_id is distinct from old.fight_id then
    raise exception 'prediction keys cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_predictions_immutable_keys on public.predictions;
create trigger trg_predictions_immutable_keys
  before update on public.predictions
  for each row
  execute function public.predictions_immutable_keys();

create function public.bonus_predictions_immutable_keys()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.event_id is distinct from old.event_id then
    raise exception 'bonus prediction keys cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bonus_predictions_immutable_keys on public.bonus_predictions;
create trigger trg_bonus_predictions_immutable_keys
  before update on public.bonus_predictions
  for each row
  execute function public.bonus_predictions_immutable_keys();

-- Recalc stays callable from the admin UI, but not from a random tipper.
create function public.assert_event_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'anon' then
    raise exception 'not authorized';
  end if;
  if auth.role() = 'authenticated' then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and (is_admin or is_superadmin)
    ) then
      raise exception 'not authorized';
    end if;
  end if;
end;
$$;

create or replace function public.recalculate_event_points(p_event_id uuid)
returns void as $$
begin
  perform public.assert_event_admin();
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

create or replace function public.recalculate_fight_points(p_fight_id uuid)
returns void as $$
begin
  perform public.assert_event_admin();
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
    and f.id = p_fight_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.recalculate_bonus_points(p_event_id uuid)
returns void as $$
begin
  perform public.assert_event_admin();
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

revoke all on function public.recalculate_event_points(uuid) from public, anon;
revoke all on function public.recalculate_fight_points(uuid) from public, anon;
revoke all on function public.recalculate_bonus_points(uuid) from public, anon;
grant execute on function public.recalculate_event_points(uuid) to authenticated, service_role;
grant execute on function public.recalculate_fight_points(uuid) to authenticated, service_role;
grant execute on function public.recalculate_bonus_points(uuid) to authenticated, service_role;

-- Completed fight with a NULL winner must not award the winner point
-- (SQL three-valued logic made `predicted <> NULL` skip the early return).
create or replace function public.calculate_points(
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
  if p_actual_winner is null or p_predicted_winner is distinct from p_actual_winner then
    return 0;
  end if;

  pts := pts + 1;

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

-- =========================================================
-- Restore admin_set_user_admin (override was dropped in superadmin.sql)
-- =========================================================
create or replace function public.protect_is_admin()
returns trigger as $$
begin
  if auth.role() = 'authenticated'
     and coalesce(current_setting('app.admin_override', true), '') <> 'on' then
    if new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
    if new.is_superadmin is distinct from old.is_superadmin then
      new.is_superadmin := old.is_superadmin;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- =========================================================
-- Leaderboard views honour prediction RLS (no pre-lock leak)
-- =========================================================
alter view public.event_leaderboard set (security_invoker = true);
alter view public.season_leaderboard set (security_invoker = true);
alter view public.group_season_leaderboard set (security_invoker = true);

-- =========================================================
-- Bold pick / FOTN fight must belong to the event
-- =========================================================
create function public.enforce_fight_belongs_to_event()
returns trigger as $$
begin
  if not exists (
    select 1 from public.fights f
    where f.id = new.fight_id and f.event_id = new.event_id
  ) then
    raise exception 'fight does not belong to event';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger bold_picks_fight_event
  before insert or update on public.bold_picks
  for each row execute function public.enforce_fight_belongs_to_event();

create function public.enforce_fotn_fight_belongs_to_event()
returns trigger as $$
begin
  if not exists (
    select 1 from public.fights f
    where f.id = new.predicted_fotn_fight_id and f.event_id = new.event_id
  ) then
    raise exception 'fight does not belong to event';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger bonus_predictions_fight_event
  before insert or update on public.bonus_predictions
  for each row execute function public.enforce_fotn_fight_belongs_to_event();

-- =========================================================
-- Invite: no anon boolean oracle; longer codes going forward
-- =========================================================
revoke execute on function public.check_invite_code(text) from anon, public;

create or replace function public.admin_set_invite_code(new_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin) then
    raise exception 'not authorized';
  end if;
  if length(trim(new_code)) < 12 then
    raise exception 'invite code too short';
  end if;
  update public.app_settings
  set value = trim(new_code), updated_at = now()
  where key = 'invite_code';
end;
$$;
