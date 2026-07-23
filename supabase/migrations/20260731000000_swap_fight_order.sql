-- Atomic card-order swap for the admin fight reorder UI. Previously the
-- client fired two independent UPDATEs in parallel; if one failed the two
-- fights could end up sharing a card_order (or with the order half-applied).
-- Doing both in one security-definer function keeps the swap all-or-nothing
-- and gates it to admins.
create function public.swap_fight_order(p_fight_a uuid, p_fight_b uuid)
returns void as $$
declare
  v_order_a integer;
  v_order_b integer;
  v_event_a uuid;
  v_event_b uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and (is_admin or is_superadmin)
  ) then
    raise exception 'Nemáš oprávnění.';
  end if;

  select card_order, event_id into v_order_a, v_event_a from public.fights where id = p_fight_a;
  select card_order, event_id into v_order_b, v_event_b from public.fights where id = p_fight_b;

  if v_order_a is null or v_order_b is null then
    raise exception 'Zápas nenalezen.';
  end if;
  if v_event_a is distinct from v_event_b then
    raise exception 'Zápasy nejsou ze stejného galavečera.';
  end if;

  update public.fights set card_order = v_order_b where id = p_fight_a;
  update public.fights set card_order = v_order_a where id = p_fight_b;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.swap_fight_order(uuid, uuid) to authenticated;
