-- Decimal betting odds for each fighter, sourced from OKTAGON's own
-- betting endpoint (api.oktagonmma.com/v1/events/{id}/fightcard/betting),
-- keyed by the same oktagon_fight_id already used for card/result imports.

alter table public.fights add column odds_fighter_a numeric;
alter table public.fights add column odds_fighter_b numeric;
