-- Per-event opt-out of the startovné pool (e.g. a test/free-for-fun
-- gala that shouldn't show pool/payout UI or announcements).
alter table public.events
  add column if not exists payouts_enabled boolean not null default true;

update public.events set payouts_enabled = false where number = 90;
