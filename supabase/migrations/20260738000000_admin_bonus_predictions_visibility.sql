-- "Kdo má natipováno" in the admin showed FOTN ✗ for everyone except the
-- admin themselves before an event locked, which made the whole column
-- useless exactly when it matters (nudging people before the deadline).
--
-- Cause: predictions got an admin read policy back in
-- 20260629000000_admin_predictions_visibility.sql, but bonus_predictions -
-- added a week earlier for the Fight of the Night pick - never did. So the
-- admin page counted fight tips for everyone and FOTN picks for one person.
--
-- Same trade-off as the predictions policy: admins can see *that* someone
-- picked, and which fight, before the deadline. The admin UI only ever shows
-- a tick or a cross.
create policy bonus_predictions_select_admin on public.bonus_predictions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
