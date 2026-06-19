-- Admins need to see who hasn't tipped yet (to nudge them) even before
-- an event locks, when normal users can only see their own predictions.
create policy predictions_select_admin on public.predictions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
