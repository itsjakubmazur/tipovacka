-- Startovné: 50 Kč per tipping participant, winner-takes-all, settled
-- peer-to-peer outside the app (bank transfer) - the app only tracks
-- who owes what and lets each person (or an admin) check themselves
-- off as paid. No money ever moves through the app itself.

alter table public.profiles
  add column if not exists bank_account text;

create table public.event_payouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index event_payouts_event_id_idx on public.event_payouts(event_id);

alter table public.event_payouts enable row level security;

-- Everyone needs to see the settlement checklist, not just the two
-- parties involved in a given row.
create policy event_payouts_select_authenticated on public.event_payouts
  for select using (auth.uid() is not null);

create policy event_payouts_insert_own_or_admin on public.event_payouts
  for insert with check (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

create policy event_payouts_update_own_or_admin on public.event_payouts
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Live updates for the checklist.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_payouts'
  ) then
    alter publication supabase_realtime add table public.event_payouts;
  end if;
end $$;

-- Kecárna gets an automatic "pool winner" system message once an event
-- is graded - system messages have no author.
alter table public.event_comments alter column user_id drop not null;
alter table public.event_comments add column is_system boolean not null default false;
alter table public.event_comments add constraint event_comments_system_no_user
  check (not is_system or user_id is null);
