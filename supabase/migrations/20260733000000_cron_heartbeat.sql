-- Dead-man's switch for the cron. The scraper is triggered by an external
-- scheduler (cron-job.org), so if that stops calling, nothing runs AND the
-- existing per-task failure alerts never fire - the outage is silent until a
-- gala fails to publish or grade. This single-row table records the last time
-- main() actually ran; cron.py checks it on each tick and alerts admins when
-- it wakes up after a gap, and (optionally) pings an external healthcheck so a
-- full outage is caught from outside.
create table public.cron_heartbeat (
  id integer primary key default 1,
  last_run_at timestamptz not null default now(),
  constraint cron_heartbeat_single check (id = 1)
);

insert into public.cron_heartbeat (id, last_run_at) values (1, now());

alter table public.cron_heartbeat enable row level security;

-- Admins may read it (for a health widget); writes go through the service
-- role from the scraper, which bypasses RLS.
create policy cron_heartbeat_admin_select on public.cron_heartbeat
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and (is_admin or is_superadmin)
    )
  );
