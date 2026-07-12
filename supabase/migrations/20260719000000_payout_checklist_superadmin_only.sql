-- Only the person themselves (or a superadmin, e.g. cash handed over
-- in person) may check someone off as paid - a regular admin no
-- longer gets to mark other people's rows, matching the UI change in
-- PayoutChecklist.
drop policy event_payouts_insert_own_or_admin on public.event_payouts;
drop policy event_payouts_update_own_or_admin on public.event_payouts;

create policy event_payouts_insert_own_or_superadmin on public.event_payouts
  for insert with check (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_superadmin)
  );

create policy event_payouts_update_own_or_superadmin on public.event_payouts
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_superadmin)
  );
