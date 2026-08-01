-- Results were read exactly once. import_results skipped any fight whose row
-- was no longer 'scheduled', so a winner OKTAGON corrected after the fact
-- never reached us: points stayed wrong, and the push telling everyone the
-- result had already gone out. Two columns make a re-check possible.

-- A human decided this one. The importer must never overwrite it - otherwise
-- an admin fixing a result OKTAGON got wrong would have it silently undone on
-- the next tick, which is precisely the case this whole change is about.
alter table public.fights
  add column if not exists result_locked boolean not null default false;

comment on column public.fights.result_locked is
  'Result entered or corrected by an admin - import_results leaves it alone.';

-- Throttles the post-gala re-check: completed events are re-read every few
-- hours for a few days, not on every five-minute tick.
alter table public.events
  add column if not exists results_rechecked_at timestamptz;

comment on column public.events.results_rechecked_at is
  'Last time a completed event was re-read from OKTAGON looking for corrections.';
