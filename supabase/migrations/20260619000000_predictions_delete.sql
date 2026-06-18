-- predictions had no DELETE policy, so RLS silently dropped 0 rows on
-- every delete (no error, no effect) instead of actually clearing a tip.
create policy predictions_delete_own on public.predictions
  for delete using (
    auth.uid() = user_id
    and exists (
      select 1 from public.fights f
      join public.events e on e.id = f.event_id
      where f.id = predictions.fight_id
        and e.status <> 'completed'
        and (e.lock_at is null or now() < e.lock_at)
    )
  );
