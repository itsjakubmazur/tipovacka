-- Fighter nationality + flag, sourced from each fighter's individual
-- Sherdog profile page (the event page itself carries no per-fighter
-- nationality markup, only the venue's flag).
alter table public.fighters add column if not exists nationality text;
alter table public.fighters add column if not exists flag_code text;
