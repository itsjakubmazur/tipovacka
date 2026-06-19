-- Surface more of what OKTAGON's API already gives us: fighter bios, the
-- dedicated fight-card photo, amateur records, ranking momentum, native
-- weight class, profile slugs, and the exact finish time of a fight.

alter table public.fighters add column bio text;
alter table public.fighters add column fight_card_photo_url text;
alter table public.fighters add column amateur_record text;
alter table public.fighters add column weight_kg integer;
alter table public.fighters add column oktagon_rank_change integer;
alter table public.fighters add column oktagon_slug text;

alter table public.fights add column result_time text;
