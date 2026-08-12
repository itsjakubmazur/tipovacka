-- Hotfix for 20260741000000_revalidation_webhooks.sql: a single shared
-- trigger function used a SQL CASE expression to pick the tag per table.
-- Postgres compiles a CASE expression as one query, so it type-checks every
-- branch's column references against whatever table actually fired the
-- trigger - even branches that don't run. The `predictions` branch's
-- `new.fight_id` doesn't exist on `fights` (or the several other tables
-- lacking a fight_id column), so every write to `fights` (and to any
-- non-predictions table) raised `record "new" has no field "fight_id"` and
-- aborted the write entirely - this broke the scraper's result imports and,
-- more importantly, event_comments/bold_picks/bonus_predictions/
-- event_payouts writes wherever their own field wasn't "fight_id".
--
-- Fix: PL/pgSQL only plans and type-checks a statement the first time
-- control flow actually reaches it, so splitting into IF/ELSIF branches
-- (each its own statement) means a table's write only ever gets type-checked
-- against that table's own branch.

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
