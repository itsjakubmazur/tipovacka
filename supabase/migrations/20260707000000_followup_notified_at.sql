-- Dedup column for the "thanks for tipping / check the leaderboard" push
-- notification, sent the day after an event at 14:00 Prague time -
-- mirrors reminder_sent_at/card_notified_at/lock_notified_at.
alter table public.events
  add column followup_notified_at timestamptz;
