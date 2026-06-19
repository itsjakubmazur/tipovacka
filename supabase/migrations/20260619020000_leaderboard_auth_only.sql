-- Leaderboards should only be visible to logged-in tippers, not to
-- anonymous visitors hitting the page or the Supabase REST API directly.
revoke select on public.event_leaderboard from anon;
revoke select on public.season_leaderboard from anon;
