-- Adds a 'draft' event status: a pre-populated event (date, location,
-- OKTAGON event id) that's only visible to admins until it's published
-- (auto, ~3 days before start, or manually) and becomes tippable.
alter table public.events drop constraint events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('draft', 'upcoming', 'locked', 'completed'));
