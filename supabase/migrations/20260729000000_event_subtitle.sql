-- Optional subtitle / main-event billing for a gala, e.g.
-- "Engizek vs. Jötko 2". The scraper auto-derives it from the main event
-- (surnames) when it's empty, and a superadmin can override it with the
-- exact official wording in the event settings.
alter table public.events add column if not exists subtitle text;
