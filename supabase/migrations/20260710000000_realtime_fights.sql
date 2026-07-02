-- Let the event detail page update live (without a manual refresh) as
-- results get entered during a galavečer - same rationale as
-- 20260620000000_realtime_predictions.sql, just for the fights table too
-- so completed results/winners refresh live, not just point totals.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fights'
  ) then
    alter publication supabase_realtime add table public.fights;
  end if;
end $$;
