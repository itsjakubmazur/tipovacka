-- Push notifications for kecárna messages: an opt-out preference plus a
-- per-comment notified_at so the cron can batch "new messages since last
-- tick" into one push per event instead of spamming one per message.
alter table public.profiles
  add column if not exists notify_comments boolean not null default true;

alter table public.event_comments
  add column if not exists notified_at timestamptz;

-- Existing rows predate this feature - backfill so the cron's first run
-- doesn't blast a push for every comment ever posted.
update public.event_comments set notified_at = created_at where notified_at is null;
