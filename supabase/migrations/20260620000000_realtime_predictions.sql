-- Let the leaderboard update live (without a manual refresh) as results
-- get entered during a galavečer. Realtime postgres_changes still goes
-- through each table's existing RLS policies, so this doesn't expose
-- anything that wasn't already readable.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'predictions'
  ) then
    alter publication supabase_realtime add table public.predictions;
  end if;
end $$;
