-- Log table for scraper runs (Sherdog card/results import, Fight Matrix
-- enrichment), written by the GitHub Actions workflow via the service
-- role key (same trust model as the scraper's other writes - it bypasses
-- RLS entirely). RLS here only governs read access for admins in the app.

create table public.scraper_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  event_id uuid references public.events(id) on delete set null,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index scraper_runs_started_at_idx on public.scraper_runs(started_at desc);

alter table public.scraper_runs enable row level security;

create policy scraper_runs_select_admin on public.scraper_runs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
