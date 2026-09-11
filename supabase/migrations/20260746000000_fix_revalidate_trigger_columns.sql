-- HOTFIX: vrací notify_revalidate() do znění z 20260741.
--
-- 20260745 do její společné CASE přidala větve pro fighter_oktagon_fights a
-- fight_stats. PostgreSQL ale u trigger funkce rozhoduje odkazy new.<sloupec>
-- pro CELÝ výraz, ne jen pro větev, která se zrovna vybere - takže jakmile
-- ve výrazu přibyl sloupec, který jiná tabulka nemá, začaly zápisy do těch
-- ostatních tabulek padat na "record \"new\" has no field ...". V praxi to
-- shodilo zápisy do fights (a tím scraper cron).
--
-- Poučení do budoucna: tuhle CASE už nerozšiřovat. Každá další tabulka
-- dostane vlastní malou trigger funkci, která si spočítá svůj tag a zavolá
-- sdílený revalidate_tag() níž.

create or replace function public.notify_revalidate() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_tag text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'revalidate_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'revalidate_secret';

  -- Nothing configured yet in this environment (e.g. local dev) - skip
  -- rather than fail the write.
  if v_url is null or v_secret is null then
    return coalesce(new, old);
  end if;

  v_tag := case TG_TABLE_NAME
    when 'events' then 'event-' || coalesce(new.id, old.id)
    when 'fights' then 'event-' || coalesce(new.event_id, old.event_id)
    when 'predictions' then (
      select 'event-' || f.event_id from public.fights f where f.id = coalesce(new.fight_id, old.fight_id)
    )
    when 'event_comments' then 'event-' || coalesce(new.event_id, old.event_id)
    when 'bold_picks' then 'event-' || coalesce(new.event_id, old.event_id)
    when 'bonus_predictions' then 'event-' || coalesce(new.event_id, old.event_id)
    when 'event_payouts' then 'event-' || coalesce(new.event_id, old.event_id)
    else null
  end;

  if v_tag is null then
    return coalesce(new, old);
  end if;

  -- Fire-and-forget: net.http_post queues onto pg_net's async worker and
  -- does not block this transaction.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'tag', v_tag)
  );

  return coalesce(new, old);
end;
$$;

-- Odesílání webhooku zvlášť, ať ho nemusí každá nová trigger funkce opisovat.
create or replace function public.revalidate_tag(v_tag text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if v_tag is null then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'revalidate_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'revalidate_secret';

  -- Nothing configured yet in this environment (e.g. local dev) - skip
  -- rather than fail the write.
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('tag', v_tag)
  );
end;
$$;

-- Vlastní funkce pro obě nové tabulky. Každá se dotýká jen svých sloupců,
-- takže nemá jak ovlivnit zápisy do čehokoli jiného.
create or replace function public.notify_revalidate_fighter() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.revalidate_tag('fighter-' || coalesce(new.fighter_id, old.fighter_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.notify_revalidate_fight_stats() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select f.event_id into v_event_id
  from public.fights f
  where f.id = coalesce(new.fight_id, old.fight_id);

  perform public.revalidate_tag('event-' || v_event_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists revalidate_after_fighter_oktagon_fights on public.fighter_oktagon_fights;
create trigger revalidate_after_fighter_oktagon_fights
  after insert or update or delete on public.fighter_oktagon_fights
  for each row execute function public.notify_revalidate_fighter();

drop trigger if exists revalidate_after_fight_stats on public.fight_stats;
create trigger revalidate_after_fight_stats
  after insert or update or delete on public.fight_stats
  for each row execute function public.notify_revalidate_fight_stats();
