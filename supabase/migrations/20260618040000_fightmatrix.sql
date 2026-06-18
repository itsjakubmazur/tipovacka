-- Fight Matrix ranking + score, shown next to each fighter (e.g.
-- "#11 Welterweight" and a numeric Points score), filled by the scraper.
alter table public.events add column fightmatrix_event_url text;
alter table public.fighters add column fightmatrix_url text;
alter table public.fighters add column fightmatrix_rank text;
alter table public.fighters add column fightmatrix_score integer;

update public.events
set fightmatrix_event_url = 'https://www.fightmatrix.com/upcoming-events/OKTAGON%2090:%20Fleury%20vs.%20Aras/110588/'
where sherdog_event_url = 'https://www.sherdog.com/events/Oktagon-MMA-Oktagon-90-Fleury-vs-Aras-110588';
