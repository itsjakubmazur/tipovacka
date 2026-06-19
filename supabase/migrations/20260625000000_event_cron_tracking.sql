-- Tracks the consolidated scraper cron's progress per event, so it can
-- tell "card not imported yet" from "already imported, just rechecking"
-- and avoid spamming a "card changed" push on every 15-minute run.
alter table public.events
  add column card_checked_at timestamptz,
  add column card_notified_at timestamptz;
