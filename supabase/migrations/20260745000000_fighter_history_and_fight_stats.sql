-- Historie zápasů bojovníka v OKTAGONU + pozápasové statistiky jednotlivých
-- zápasů. Obojí je čistě zobrazovací - tipovací a bodovací logika se těchhle
-- tabulek nedotkne.
--
-- Proč vlastní tabulka a ne `fights`: `fights` + `events` živí bodování,
-- sezónní žebříček (season = rok z events.event_date) i seznam galavečerů.
-- Doimportovat sem OKTAGON 1 z roku 2016 by rozbilo žebříček a zaplavilo
-- appku eventy, které parta nikdy netipovala.

-- OKTAGON vede u starších bojovníků a zápasů ještě `legacyId` z původního
-- systému. Sami ho nepotřebujeme, ale je to jediný klíč, kterým jde spárovat
-- bojovníka s externím statistickým systémem (viz fight_stats níž).
alter table public.fighters add column if not exists oktagon_legacy_id integer;

-- `metadata.esportsId` ze zápasu na kartě - klíč do stejného systému.
alter table public.fights add column if not exists oktagon_esports_id integer;

-- =========================================================
-- HISTORIE ZÁPASŮ BOJOVNÍKA
-- =========================================================
-- Jeden řádek na (bojovník, zápas), tedy z pohledu konkrétního bojovníka -
-- dotaz na profil je pak prostý "where fighter_id = ? order by event_date desc"
-- bez OR přes dva sloupce. Soupeř má vlastní odkaz do `fighters` jen tehdy,
-- když ho v DB vůbec máme (tj. nastoupil na některé kartě, kterou parta
-- tipovala); jinak stačí jméno a fotka z OKTAGON API.
create table public.fighter_oktagon_fights (
  fighter_id uuid not null references public.fighters(id) on delete cascade,
  oktagon_fight_id integer not null,
  event_date timestamptz not null,
  event_label text not null,
  event_number integer,
  opponent_name text not null,
  opponent_fighter_id uuid references public.fighters(id) on delete set null,
  opponent_oktagon_fighter_id integer,
  opponent_slug text,
  opponent_photo_url text,
  outcome text not null check (outcome in ('win', 'loss', 'draw', 'no_contest')),
  -- syrové od OKTAGONu ("KO"/"TKO"/"SUB"/"DEC"), ne náš třívalentní `method`:
  -- v historii je rozdíl mezi KO a TKO informace navíc a zobrazovací data
  -- nemají důvod se ohýbat do bodovacího číselníku
  result_type text,
  -- kolo, ve kterém zápas SKONČIL (ne naplánovaná délka) - OKTAGON tomu
  -- v API říká matoucně `numRounds`
  end_round integer,
  end_time text,
  title_fight boolean not null default false,
  weight_class text,
  updated_at timestamptz not null default now(),
  primary key (fighter_id, oktagon_fight_id)
);

create index fighter_oktagon_fights_by_date
  on public.fighter_oktagon_fights (fighter_id, event_date desc);

-- "zápasili spolu už někdy?" - hledá se podle oktagon_fight_id napříč oběma
-- bojovníky nadcházejícího zápasu
create index fighter_oktagon_fights_by_fight
  on public.fighter_oktagon_fights (oktagon_fight_id);

alter table public.fighter_oktagon_fights enable row level security;

create policy fighter_oktagon_fights_select on public.fighter_oktagon_fights
  for select to authenticated
  using (true);

-- Zapisuje jen scraper service-role klíčem, který RLS obchází.
revoke insert, update, delete on public.fighter_oktagon_fights from anon, authenticated;
grant select on public.fighter_oktagon_fights to authenticated;

-- =========================================================
-- POZÁPASOVÉ STATISTIKY
-- =========================================================
-- Agregáty z externího trackovacího systému (oktagon.sh12w3.esports.cz),
-- na který se odkazuje samotný web OKTAGONu. Cizí doména bez SLA, data
-- existují zhruba od poloviny 2024 a u konkrétního zápasu klidně chybět
-- můžou - proto je tabulka řídká a UI musí umět "žádná data".
create table public.fight_stats (
  fight_id uuid primary key references public.fights(id) on delete cascade,
  esports_match_id integer not null,
  fighter_a_hits integer not null default 0,
  fighter_a_significant_hits integer not null default 0,
  fighter_a_takedowns integer not null default 0,
  fighter_a_takedown_attempts integer not null default 0,
  fighter_a_submission_attempts integer not null default 0,
  fighter_b_hits integer not null default 0,
  fighter_b_significant_hits integer not null default 0,
  fighter_b_takedowns integer not null default 0,
  fighter_b_takedown_attempts integer not null default 0,
  fighter_b_submission_attempts integer not null default 0,
  -- rozpad po kolech: [{"round": 1, "a": {...}, "b": {...}}, ...]
  rounds jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.fight_stats enable row level security;

-- Stejná viditelnost jako samotné zápasy: nic z karty skrytého galavečera.
-- Statistiky navíc ze své podstaty vznikají až po odzápasení, takže na tipy
-- nemají jak mít vliv.
create policy fight_stats_select_visible on public.fight_stats
  for select to authenticated
  using (
    exists (
      select 1 from public.fights f
      join public.events e on e.id = f.event_id
      where f.id = fight_stats.fight_id and e.status <> 'draft'
    )
  );

revoke insert, update, delete on public.fight_stats from anon, authenticated;
grant select on public.fight_stats to authenticated;

-- =========================================================
-- Invalidace cache
-- =========================================================
-- Scraper píše service-role klíčem mimo Next.js, takže bez tohohle by se
-- nová data objevila až po vypršení TTL (viz 20260741_revalidation_webhooks).
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
    when 'fight_stats' then (
      select 'event-' || f.event_id from public.fights f where f.id = coalesce(new.fight_id, old.fight_id)
    )
    when 'fighter_oktagon_fights' then 'fighter-' || coalesce(new.fighter_id, old.fighter_id)
    else null
  end;

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

drop trigger if exists revalidate_after_fight_stats on public.fight_stats;
create trigger revalidate_after_fight_stats after insert or update or delete on public.fight_stats
  for each row execute function public.notify_revalidate();

drop trigger if exists revalidate_after_fighter_oktagon_fights on public.fighter_oktagon_fights;
create trigger revalidate_after_fighter_oktagon_fights after insert or update or delete on public.fighter_oktagon_fights
  for each row execute function public.notify_revalidate();
