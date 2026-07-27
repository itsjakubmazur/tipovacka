-- Marks one-off, per-season broadcast notifications as sent, so the cron
-- (which ticks every few minutes) fires each of them exactly once. First use:
-- the "season is wrapping up, here's where you stand" heads-up in December.
create table public.season_notifications (
  season integer not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (season, kind)
);

alter table public.season_notifications enable row level security;
-- No policies: only the service-role scraper touches this table (RLS-exempt).
