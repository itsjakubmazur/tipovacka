-- Druhý klíč k pozápasovým statistikám.
--
-- Externí tracking (oktagon.sh12w3.esports.cz) umí zápas najít dvěma
-- způsoby a OKTAGON na webu mezi nimi přepíná podle stáří zápasu:
--   * nové zápasy  -> /api/export/matches/{fights.oktagon_esports_id}
--     (to je `metadata.esportsId` z jejich API, existuje zhruba od 2023)
--   * starší       -> /api/export/matches/external/{fights.oktagon_legacy_id}
--     (to je `legacyId` zápasu, existuje naopak u starých zápasů)
--
-- Bez téhle druhé kolonky jsme se u ničeho před rokem 2023 neměli čím
-- doptat - a přitom tracking ta data má až k OKTAGONU 5.
alter table public.fights add column if not exists oktagon_legacy_id integer;

comment on column public.fights.oktagon_legacy_id is
  'legacyId zápasu z api.oktagonmma.com - klíč k pozápasovým statistikám u starších zápasů (endpoint /matches/external/{id}).';

-- Importy statistik se ptají přesně na "má klíč a ještě nemá statistiky".
create index if not exists fights_oktagon_legacy_id_idx
  on public.fights (oktagon_legacy_id)
  where oktagon_legacy_id is not null;
