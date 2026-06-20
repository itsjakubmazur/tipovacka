-- OKTAGON's fightcard API groups fights into named cards ("HEAVYWEIGHT
-- TITLE FIGHT", "MAIN CARD", "PRELIMS", "FREE PRELIMS", ...). We collapse
-- title-fight cards into main_card since they're headliners, not a
-- separate broadcast segment.
alter table public.fights
  add column card_segment text check (card_segment in ('main_card', 'prelims', 'free_prelims'));
