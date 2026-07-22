-- One-shot tracking for the ~6-days-before "watch OKTAGON's YouTube"
-- heads-up push, so it fires exactly once per gala.
alter table public.events
  add column if not exists hype_notified_at timestamptz;
