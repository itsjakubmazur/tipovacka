# Shape plán — Sledovačka („OG live“)

Návrh, ne schválený scope. Admin (host) vypíše, že u sebe v garáži pořádá
sledování galavečera; tipéři zaznačí, jestli dorazí. Cílem téhle verze je
**logistika, ne nová herní mechanika** — do bodů, uzávěrek ani žebříčků se
nesahá (produktový princip 5).

## Job a publikum
Parta ~10 lidí, 90 % na mobilu. Dnes se domlouvá „kdo dorazí“ v kecárně nebo
mimo appku a nikdo nemá přehled, kolik lidí přijde a jestli má host koupit
šest nebo dvanáct piv. Job: **do dvou klepnutí odpovědět „dorazím / možná /
ne“ a na jednom místě vidět, kolik nás bude.**

Jméno v UI: **Sledovačka** (appka se jmenuje OKTAGON GARÁŽ, „OG live“ by
znělo jako další produktová značka). Sekce v detailu galavečera.

## Datový model

Dvě tabulky, stejný styl jako `event_comments` / `event_payouts` — browser
píše přímo anon klíčem, autorizace je RLS.

```sql
create table public.watch_parties (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  place text not null,                 -- "U Kubyho v garáži"
  address text,                        -- volitelně přesná adresa
  map_url text,                        -- volitelně odkaz na mapy
  starts_at timestamptz not null,      -- předvyplní se z events.lock_at - 30 min
  capacity integer,                    -- null = neomezeno (jen informativní, viz níž)
  note text check (char_length(note) <= 500),
  status text not null default 'open'
    check (status in ('open', 'cancelled')),
  announced_at timestamptz,            -- marker odeslaného pushe
  reminder_sent_at timestamptz,        -- marker připomínky v den galavečera
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, host_user_id)      -- jeden host = jedna sledovačka na galavečer
);

create table public.watch_party_rsvps (
  party_id uuid not null references public.watch_parties(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  plus_ones integer not null default 0 check (plus_ones between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

-- Na jeden galavečer se dá slíbit účast jen na jedné sledovačce.
-- Ve v1 stejně existuje maximálně jedna, ale index to drží zadarmo,
-- až bude sledovaček víc.
create unique index watch_party_rsvps_one_yes_per_event
  on public.watch_party_rsvps (event_id, user_id) where answer = 'yes';
```

`event_id` v RSVP je denormalizace kvůli tomu indexu a kvůli levnému dotazu
„kolik nás dorazí na tenhle galavečer“ bez joinu.

### RLS
- `watch_parties` select: `auth.uid() is not null` (celá appka je stejně za
  auth gate v `src/proxy.ts`).
- insert: `auth.uid() = host_user_id` **a** `is_admin` — `host_user_id`
  navázaný na `auth.uid()` brání tomu vypsat sledovačku cizím jménem.
- update/delete: host nebo admin.
- `watch_party_rsvps` select: `auth.uid() is not null` (účast je veřejná
  uvnitř party, viz Soukromí). insert/update/delete: `auth.uid() = user_id`,
  delete navíc admin (úklid).
- Obě tabulky přidat do publikace `supabase_realtime` (stejný `do $$` blok
  jako v migraci `20260712000000_event_comments.sql`).

### Kapacita
Tvrdé vynucení kapacity přes RLS je závod (dva lidi kliknou naráz) a chtělo by
`security definer` RPC se zámkem řádku. Pro deset kamarádů to nestojí za
riziko: **kapacita je jen informativní** („zbývají 2 místa“), přeplnění řeší
host. Tvrdý limit je pozdější RPC, ne v1.

## UI

Jedna karta `.glass-surface` v pravém sloupci detailu galavečera, hned nad
kecárnou (`src/components/events/personalized-event-data.tsx:252`) — patří
k sociálním blokům, aby netlačila fight card, kde se tipuje (princip 2).

Obsah karty:
- Hlavička: „SLEDOVAČKA“ + přezdívka hosta.
- Místo, čas, volitelně odkaz na mapy a poznámka („vem si pití, gril je můj“).
- Odpověď: `SegmentedControl` (`src/components/ui/segmented-control.tsx`) se
  třemi segmenty **Dorazím / Možná / Nedorazím**, vybraný segment `.glass-accent`
  (Lit-Not-Flat pravidlo z DESIGN.md). Zápis optimisticky, realtime na
  `watch_party_rsvps` dorovná ostatní.
- Souhrn: „7 dorazí · 2 možná · 1 ne“ + jména pod tím.
- Host má inline tlačítka Upravit / Zrušit — žádná další obrazovka; admin
  sekce je interní a tohle je věc party.

Stavy:
- **Není sledovačka**: tipérům se nezobrazí nic. Admin vidí decentní tlačítko
  „Vypsat sledovačku“ (formulář ve `Modal`u, stejná mechanika jako ostatní
  admin formuláře, čas přes `pragueLocalToUtcIso` z `src/lib/time.ts`).
- **Neodpovězeno**: v horní části stránky (u `EventStatusTimeline`) se objeví
  úzký pill „🍺 Sledovačka u Kubyho — dorazíš?“, který **jen odscrolluje** na
  kartu. Nekopíruje CTA (poučení z B-5), stejný vzorec jako `JumpToUntipped`.
- **Zrušeno**: karta zešedne, `.glass-danger` badge „Zrušeno“, RSVP zamčené.
- **Po vyhodnocení**: karta se smrskne na jeden řádek „V garáži nás bylo 9“.

Mimo scope v1: badge v seznamu galavečerů (`src/lib/data/events-list.ts` je
cachovaný, chtělo by to sáhnout na revalidační trigger — viz Cache) a propojení
s `WatchingNow` presencí („5 z 9 už je v garáži“).

## Cache
Karta se renderuje uvnitř `PersonalizedEventData`, což je necachovaná půlka
detailu (`getEventShared` cache se jí netýká) — **v1 tedy nesahá na
`notify_revalidate` trigger ani na `extraTagsForTable`**. Jakmile by se
sledovačka dostala do cachovaného shellu nebo do seznamu galavečerů, musí se
do CASE v `supabase/migrations/20260741000000_revalidation_webhooks.sql`
přidat `watch_parties` (přes `event_id`) a `watch_party_rsvps`, pozor na typy
ve větvích CASE (viz oprava v migraci `20260742000000`).

## Notifikace
Všechny pushe v projektu odesílá `scraper/cron.py` a loguje je `push_log`,
takže i tahle jde tudy — ne přes `workflow_dispatch` jako admin broadcast.

1. **Vypsáno** (`kind="watch_party"`, marker `watch_parties.announced_at`):
   „🍺 Sledovačka u Kubyho“ / „OKTAGON 90 v sobotu od 20:00 — dorazíš?“,
   url `/events/<id>`.
2. **Připomínka v den galavečera** (marker `reminder_sent_at`, ~12:00 Prague)
   jen těm, co odpověděli „možná“ nebo neodpověděli vůbec.
3. Push hostovi při každém RSVP **ne** — u deseti lidí je to spam.

Navazující drobnosti, na které se dá zapomenout:
- `profiles.notify_watch_party boolean not null default true` + přepínač v
  `src/components/profile/notification-preferences.tsx` (předává se jako `pref`
  do `push.send_to_all`).
- Nový řádek v `src/components/admin/notification-checklist.tsx` — soubor si to
  v komentáři výslovně říká, jinak checklist tiše podhlásí.
- Sedmá podmínka ve `findPendingWork()` v `src/app/api/cron-tick/route.ts`
  („watch party announcement pending“), jinak se cron rozjede až s dalším
  důvodem.
- pytest podle vzoru `scraper/tests/test_cron_lock_reminders.py`.

## Soukromí
- **Adresa nikdy nejde do těla pushe.** Push říká „u Kubyho“, adresa žije
  v appce za auth gate. Notifikace se válí na zamčené obrazovce a prochází
  push službou.
- Jména účastníků vidí všichni — schválně naopak než `WatchingNow`, kde je
  komentář o tom, že seznam koukajících je sledování. Rozdíl: RSVP je
  dobrovolné a akční, člověk ho dělá právě proto, aby ostatní věděli.

## Co zůstává nedotčené
`calculate_points`, uzávěrky, `event_leaderboard` / `season_leaderboard`,
predictions RLS, scraper import karet a výsledků, `getEventShared` cache.
Feature je čistě aditivní: dvě nové tabulky, jedna karta, jeden push kind.

## Rozsah práce
1. Migrace (tabulky, RLS, realtime) — 1 soubor.
2. `watch-party-card.tsx` + `watch-party-form.tsx` + zapojení do
   `PersonalizedEventData` — hlavní kus.
3. `notify_watch_party` + přepínač v profilu.
4. `cron.py` (dva pushe), cron-tick podmínka, checklist řádek, pytest.
5. Průchod textů (čeština, hláškový tón).

Odhad: jeden pořádný večer. Bez pushů (body 3–4) zhruba polovina.

## Otevřené otázky do debaty
1. **Kdo může vypsat sledovačku** — jen admin (jak je návrh), nebo kdokoliv
   z party? Schéma na „kdokoliv“ už je připravené, je to jen RLS podmínka a UI.
2. **Víc sledovaček na jeden galavečer** (garáž vs. hospoda)? Schéma to unese,
   UI by potřebovalo přepínač mezi nimi.
3. **Push hned při vypsání** všem, nebo tiše a stačí to ukázat v appce?
4. **Kapacita a `+1`** (partnerky, kámoš mimo appku) — chceme, nebo je to
   zbytečné pole navíc?
5. **Má se docházka počítat dál** (wrapped, statistiky typu „byl jsi v garáži
   6× ze 7“)? Posouvá to feature z logistiky do achievementů.
6. **Adresa** — uložit hostovi jednou k profilu a předvyplňovat, nebo psát
   pokaždé ručně?
