-- When true, the subtitle was set by hand (superadmin) and the scraper
-- must not overwrite it with the auto value pulled from OKTAGON's title.
alter table public.events add column if not exists subtitle_locked boolean not null default false;
