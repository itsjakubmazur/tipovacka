-- Web push subscriptions, so the scraper cron can remind people who
-- haven't finished tipping before an event locks. Subscriptions are
-- only ever read/written by their own user from the app, or by the
-- service_role scraper job (which bypasses RLS) when sending reminders.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy push_subscriptions_update_own on public.push_subscriptions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Marks when a "lock is coming up" reminder was already sent for an
-- event, so the cron job (which runs every few minutes) doesn't spam
-- everyone on every run.
alter table public.events
  add column reminder_sent_at timestamptz;
