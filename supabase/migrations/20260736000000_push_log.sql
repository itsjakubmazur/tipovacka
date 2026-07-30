-- One row per push *campaign* (not per device), so the admin can see what was
-- actually sent for a gala instead of inferring it from a handful of
-- events.*_notified_at columns. Three broadcasts had no marker at all before
-- this - the "card changed" push (which can legitimately fire more than once),
-- the manual admin broadcast, and the winner's "vyhrál jsi startovné".
create table public.push_log (
  id uuid primary key default gen_random_uuid(),
  -- matches the `kind` passed to push.send_to_all / push.log_push
  kind text not null,
  -- null for sends that aren't about one gala (manual broadcast, season wrap)
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  body text not null default '',
  -- people reached, not devices
  recipients integer not null default 0,
  sent_at timestamptz not null default now()
);

create index push_log_event_sent_idx on public.push_log (event_id, sent_at desc);
create index push_log_sent_idx on public.push_log (sent_at desc);

alter table public.push_log enable row level security;

-- Read-only for admins; only the service-role scraper writes (RLS-exempt).
create policy "Admins can read the push log"
  on public.push_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );
