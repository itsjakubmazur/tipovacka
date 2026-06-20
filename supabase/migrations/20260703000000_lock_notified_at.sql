-- Dedup column for the "gala starts, tips are closed" push notification,
-- sent once lock_at has passed - mirrors reminder_sent_at/card_notified_at.
alter table public.events
  add column lock_notified_at timestamptz;
