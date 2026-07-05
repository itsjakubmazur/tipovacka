-- Per-user push notification preferences. Everything defaults to on
-- (matches previous behavior); the profile page exposes toggles.
-- One-off event-level pushes (tips locked, results done, followup)
-- intentionally have no toggle - they're rare and central to the game.
alter table public.profiles
  add column if not exists notify_fight_results boolean not null default true,
  add column if not exists notify_reminders boolean not null default true,
  add column if not exists notify_card_updates boolean not null default true;
