-- Draft fight cards must not leak before publish. The admin card import
-- (triggerSherdogImport) writes a draft event's full card - fighters, odds,
-- lock time - into `fights` while the event is still draft. With
-- fights_select_all using(true) any authenticated user could pull that card
-- straight from the REST API before it's published, spoiling the reveal and
-- handing out early prep.
--
-- Draft *events* stay readable on purpose (the "next gala" teaser shows the
-- soonest draft to everyone); only their fights are gated. Once an event
-- leaves draft the card is public as before. Results are never a concern:
-- they only exist on completed fights of already-public events. Admins keep
-- full visibility; the scraper uses the service role and bypasses RLS.
drop policy fights_select_all on public.fights;

create policy fights_select_visible on public.fights
  for select using (
    exists (
      select 1 from public.events e
      where e.id = fights.event_id and e.status <> 'draft'
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and (is_admin or is_superadmin)
    )
  );
