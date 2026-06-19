-- Amateur record isn't interesting to tippers - drop it again.
alter table public.fighters drop column amateur_record;

-- OKTAGON's weightKg is decimal (e.g. 83.9), not a whole number - the
-- integer column rejected every fighter whose weight wasn't a round kg,
-- crashing the whole card import partway through (only the first fighter
-- processed got its update committed before the failure).
alter table public.fighters alter column weight_kg type numeric(5,1);
