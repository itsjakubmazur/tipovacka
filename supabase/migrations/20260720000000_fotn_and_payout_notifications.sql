-- Two new one-shot notification tracking columns:
-- fotn_reminder_sent_at - nudges admins once a gala's fights are all
--   graded but nobody has entered Fight of the Night yet (the one
--   manual step blocking the event from completing at all).
-- payout_all_paid_notified_at - tells the startovné winner once every
--   other tipper has checked themselves off as paid.
alter table public.events
  add column if not exists fotn_reminder_sent_at timestamptz,
  add column if not exists payout_all_paid_notified_at timestamptz;
