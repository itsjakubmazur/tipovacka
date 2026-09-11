-- Vrací notify_revalidate() do IF/ELSIF podoby z 20260742.
--
-- 20260745 tuhle funkci přepsala a omylem přitom vyšla ze znění v 20260741,
-- tedy z doby PŘED opravou v 20260742 - a vrátila tím do provozu přesně tu
-- chybu, kterou 20260742 popisuje: SQL CASE se plánuje jako jeden výraz, a
-- tak se typová kontrola dělá i na větve, které pro danou tabulku neběží.
-- Zápisy do fights zase začaly padat na 'record "new" has no field
-- "fight_id"'. Můj první hotfix (20260746) to nespravil, protože obnovil
-- taky 20260741.
--
-- Triggery obou nových tabulek zůstávají na vlastních funkcích z 20260746 -
-- ty sahají jen na své sloupce, takže do téhle funkce už nikdy nikdo
-- nemusí sáhnout.

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

  if v_url is null or v_secret is null then
    return coalesce(new, old);
  end if;

  if TG_TABLE_NAME = 'events' then
    v_tag := 'event-' || coalesce(new.id, old.id);
  elsif TG_TABLE_NAME = 'fights' then
    v_tag := 'event-' || coalesce(new.event_id, old.event_id);
  elsif TG_TABLE_NAME = 'predictions' then
    select 'event-' || f.event_id into v_tag
      from public.fights f
      where f.id = coalesce(new.fight_id, old.fight_id);
  elsif TG_TABLE_NAME = 'event_comments' then
    v_tag := 'event-' || coalesce(new.event_id, old.event_id);
  elsif TG_TABLE_NAME = 'bold_picks' then
    v_tag := 'event-' || coalesce(new.event_id, old.event_id);
  elsif TG_TABLE_NAME = 'bonus_predictions' then
    v_tag := 'event-' || coalesce(new.event_id, old.event_id);
  elsif TG_TABLE_NAME = 'event_payouts' then
    v_tag := 'event-' || coalesce(new.event_id, old.event_id);
  end if;

  if v_tag is null then
    return coalesce(new, old);
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'tag', v_tag)
  );

  return coalesce(new, old);
end;
$$;
