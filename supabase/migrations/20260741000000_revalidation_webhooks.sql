-- Server-side cache invalidation. Every write that should bust the Next.js
-- unstable_cache layer (admin corrections via the browser anon client, or
-- the scraper via the service-role key - both bypass Next request handling
-- entirely) fires a pg_net webhook into /api/internal/revalidate, which
-- calls revalidateTag(). DB-level so it fires identically regardless of
-- which of those two write paths made the change.
--
-- Two secrets are read from Vault rather than hardcoded so this migration
-- is environment-agnostic:
--   revalidate_url    - e.g. https://tipovacka.vercel.app/api/internal/revalidate
--   revalidate_secret - shared with the app's REVALIDATE_SECRET env var
-- Set them once per environment with:
--   select vault.create_secret('https://...', 'revalidate_url');
--   select vault.create_secret('<random>', 'revalidate_secret');

create extension if not exists pg_net with schema extensions;

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

drop trigger if exists revalidate_after_events on public.events;
create trigger revalidate_after_events after insert or update or delete on public.events
  for each row execute function public.notify_revalidate();

drop trigger if exists revalidate_after_fights on public.fights;
create trigger revalidate_after_fights after insert or update or delete on public.fights
  for each row execute function public.notify_revalidate();

drop trigger if exists revalidate_after_predictions on public.predictions;
create trigger revalidate_after_predictions after insert or update or delete on public.predictions
  for each row execute function public.notify_revalidate();

drop trigger if exists revalidate_after_event_comments on public.event_comments;
create trigger revalidate_after_event_comments after insert or update or delete on public.event_comments
  for each row execute function public.notify_revalidate();

drop trigger if exists revalidate_after_bold_picks on public.bold_picks;
create trigger revalidate_after_bold_picks after insert or update or delete on public.bold_picks
  for each row execute function public.notify_revalidate();

drop trigger if exists revalidate_after_bonus_predictions on public.bonus_predictions;
create trigger revalidate_after_bonus_predictions after insert or update or delete on public.bonus_predictions
  for each row execute function public.notify_revalidate();

drop trigger if exists revalidate_after_event_payouts on public.event_payouts;
create trigger revalidate_after_event_payouts after insert or update or delete on public.event_payouts
  for each row execute function public.notify_revalidate();
