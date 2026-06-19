-- Replace Sherdog + Fight Matrix scraping with OKTAGON's own backend API
-- (api.oktagonmma.com/v1) as the single source of truth for fighters,
-- cards, results, and rankings.

alter table public.events add column oktagon_event_id integer unique;
alter table public.events drop column sherdog_event_url;
alter table public.events drop column fightmatrix_event_url;

alter table public.fighters add column oktagon_fighter_id integer unique;
alter table public.fighters add column height_cm integer;
alter table public.fighters add column birth_date date;
alter table public.fighters add column oktagon_rank text;
alter table public.fighters drop column sherdog_slug;
alter table public.fighters drop column fightmatrix_url;
alter table public.fighters drop column fightmatrix_rank;
alter table public.fighters drop column fightmatrix_score;

alter table public.fights add column oktagon_fight_id integer unique;
