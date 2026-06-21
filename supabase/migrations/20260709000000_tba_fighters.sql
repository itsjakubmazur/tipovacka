-- OKTAGON sometimes posts a fight before both opponents are confirmed.
-- Each unannounced slot gets its own placeholder fighter row (name "TBA",
-- is_tba = true) instead of leaving fighter_a_id/fighter_b_id null, so the
-- existing NOT NULL foreign keys and "distinct fighters" check on fights
-- don't need to change.
alter table public.fighters add column is_tba boolean not null default false;
