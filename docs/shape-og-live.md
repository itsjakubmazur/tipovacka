# Shape plán — Sledovačka („OG live“)

Návrh, ne schválený scope. Admin vypíše, že se galavečer sleduje u Rejdoše
v garáži; tipéři zaznačí, jestli dorazí a jestli sami. Cílem téhle verze je
**logistika, ne nová herní mechanika** — do bodů, uzávěrek ani žebříčků se
nesahá (produktový princip 5) a docházka se nikam dál nepočítá.

## Job a publikum
Parta ~10 lidí, 90 % na mobilu. Dnes se domlouvá „kdo dorazí“ v kecárně nebo
mimo appku a nikdo nemá přehled, kolik lidí přijde a kolik piv koupit. Job:
**do jednoho klepnutí odpovědět a na jednom místě vidět, kolik nás bude.**

Jméno v UI: **Sledovačka** (appka se jmenuje OKTAGON GARÁŽ, „OG live“ by
znělo jako další produktová značka).

## Zadaná rozhodnutí
- Vypsat sledovačku může **jen admin nebo superadmin**.
- **Vždycky garáž u Rejdoše**, nikde jinde — místo není pole ve formuláři,
  je to konstanta. Žádné adresy, mapy ani víc sledovaček na jeden galavečer.
- Čtyři odpovědi: **Přijdu sám / Přijdu s někým / Možná / Ne**.
- Karta musí být na mobilu **nahoře**, ne až pod fight cardou.
- Docházka se **nepočítá** do wrapped ani do statistik.

## Datový model

Dvě tabulky, stejný styl jako `event_comments` / `event_payouts` — browser
píše přímo anon klíčem, autorizace je RLS.

```sql
create table public.watch_parties (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,      -- předvyplní se z events.lock_at
  note text check (char_length(note) <= 500),
  status text not null default 'open'
    check (status in ('open', 'cancelled')),
  announced_at timestamptz,            -- marker odeslaného pushe (viz Notifikace)
  reminder_sent_at timestamptz,        -- marker připomínky v den galavečera
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.watch_party_rsvps (
  party_id uuid not null references public.watch_parties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  -- kolik lidí navíc přivedu; 0 = "přijdu sám", 1+ = "přijdu s někým"
  plus_ones integer not null default 0 check (plus_ones between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (party_id, user_id)
);
```

`unique` na `event_id` drží pravidlo „jedna sledovačka na galavečer“ přímo
v databázi, ne jen v UI. Místo v tabulce není — je konstanta v kódu
(`WATCH_PARTY_PLACE = "Garáž u Rejdoše"`), takže se nedá omylem přepsat a
nedá se z ní stát pole, které by někdo musel vyplňovat.

Čtyři segmenty v UI se mapují na dva sloupce: **Přijdu sám** = `yes`/`0`,
**Přijdu s někým** = `yes`/`1` (s malým `+`/`−` pro víc hostů), **Možná** =
`maybe`, **Ne** = `no`. Součet „kolik nás bude“ je pak jeden dotaz
(`sum(1 + plus_ones) where answer = 'yes'`) místo počítání enum hodnot.

### RLS
- `watch_parties` select: `auth.uid() is not null` (celá appka je stejně za
  auth gate v `src/proxy.ts`).
- insert: `auth.uid() = host_user_id` **a** `(is_admin or is_superadmin)` —
  `host_user_id` navázaný na `auth.uid()` brání vypsat sledovačku cizím jménem.
  (`is_superadmin` je samostatný flag, ne nadmnožina `is_admin`, viz migrace
  `20260708000000_superadmin.sql` — proto musí být v podmínce oba.)
- update/delete: host nebo admin.
- `watch_party_rsvps` select: `auth.uid() is not null` (účast je uvnitř party
  veřejná, viz Soukromí). insert/update/delete: `auth.uid() = user_id`,
  delete navíc admin (úklid).
- Obě tabulky přidat do publikace `supabase_realtime` (stejný `do $$` blok
  jako v migraci `20260712000000_event_comments.sql`).

## UI a umístění

Karta `.glass-surface` jde **hned pod `EventStatusTimeline`**, tzn. do
`src/components/events/personalized-event-data.tsx` kolem řádku 217.

To je přesně to „nahoře“: `<aside>` má na mobilu `className="contents"`
(řádek 169), takže celý přehledový sloupec je v DOM **před** fight cardou a
na mobilu se vykreslí nad ní. Karta tak sedí jako druhý blok hned pod
odpočtem, ještě nad zápasy — a na desktopu je nahoře v pravém sticky sloupci.
Žádný scroll pill navíc není potřeba (a nevznikne tím duplicitní CTA, viz
poučení z B-5 v `docs/shape-fight-card.md`).

Obsah karty:
- Hlavička: „SLEDOVAČKA“ + „Garáž u Rejdoše“ + čas.
- Volitelná poznámka od hosta („vem si pití, gril je můj“).
- Odpověď: `SegmentedControl` (`src/components/ui/segmented-control.tsx`) se
  čtyřmi segmenty, vybraný `.glass-accent` (Lit-Not-Flat pravidlo z DESIGN.md).
  Na úzkém mobilu se čtyři plné popisky nevejdou — segmenty jsou zkrácené
  („Sám / S někým / Možná / Ne“) s plným `title` pro čtečky.
- Souhrn: „**Bude nás 9** · 7 dorazí (+2) · 2 možná · 1 ne“ a pod tím jména.
- Zápis optimisticky, realtime na `watch_party_rsvps` dorovná ostatní.
- Host má inline tlačítka Upravit / Zrušit — žádná další obrazovka.

Stavy:
- **Není sledovačka**: tipérům se nezobrazí nic (žádné prázdné místo navíc
  nad fight cardou). Admin vidí decentní tlačítko „Vypsat sledovačku“;
  formulář je jen čas (předvyplněný z `event.lock_at`, přes
  `pragueLocalToUtcIso` z `src/lib/time.ts`) a nepovinná poznámka.
- **Neodpovězeno**: segmenty prázdné, karta drží plnou výšku — je to první
  věc pod odpočtem, nepotřebuje se dovolávat pozornosti navíc.
- **Zrušeno**: karta zešedne, `.glass-danger` badge „Zrušeno“, RSVP zamčené.
- **Po vyhodnocení**: karta se smrskne na jeden řádek „V garáži nás bylo 9“.

Mimo scope v1: badge v seznamu galavečerů (`src/lib/data/events-list.ts` je
cachovaný, chtělo by to sáhnout na revalidační trigger — viz Cache) a
propojení s `WatchingNow` presencí („5 z 9 už je v garáži“).

## Cache
Karta se renderuje uvnitř `PersonalizedEventData`, což je necachovaná půlka
detailu (`getEventShared` cache se jí netýká) — **v1 tedy nesahá na
`notify_revalidate` trigger ani na `extraTagsForTable`**. Jakmile by se
sledovačka dostala do cachovaného shellu nebo do seznamu galavečerů, musí se
do CASE v `supabase/migrations/20260741000000_revalidation_webhooks.sql`
přidat `watch_parties` (přes `event_id`) a `watch_party_rsvps` (přes
`party_id` subselect), pozor na typy ve větvích CASE (viz oprava v migraci
`20260742000000`).

## Notifikace (otevřené — čeká na rozhodnutí)
„Push“ = upozornění na zamčenou obrazovku telefonu, které už appka posílá
(hodinu před uzávěrkou, výsledky, nové zprávy v kecárně) — infrastruktura
existuje, odesílá ji `scraper/cron.py` a loguje `push_log`. Tady by dávaly
smysl dvě:

1. **Vypsáno** (`kind="watch_party"`, marker `watch_parties.announced_at`):
   „🍺 Sledovačka u Rejdoše“ / „OKTAGON 90 v sobotu od 20:00 — dorazíš?“,
   url `/events/<id>`.
2. **Připomínka v den galavečera** (marker `reminder_sent_at`, ~12:00 Prague)
   jen těm, co dali „možná“ nebo neodpověděli vůbec.
3. Push hostovi při každém RSVP **ne** — u deseti lidí je to spam.

Bez pushů feature funguje taky, jen se lidi o sledovačce dozví, až otevřou
appku (což před galavečerem stejně dělají kvůli tipům).

Když se pushe schválí, patří k nim drobnosti, na které se zapomíná:
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
Adresa nikde není (garáž zná každý), takže odpadá i riziko, že by se dostala
do těla pushe — ten mluví jen o „garáži u Rejdoše“.

Jména účastníků vidí všichni — schválně naopak než `WatchingNow`, kde je
komentář o tom, že seznam koukajících je sledování. Rozdíl: RSVP je
dobrovolné a akční, člověk ho dělá právě proto, aby ostatní věděli.

## Co zůstává nedotčené
`calculate_points`, uzávěrky, `event_leaderboard` / `season_leaderboard`,
predictions RLS, scraper import karet a výsledků, `getEventShared` cache.
Feature je čistě aditivní: dvě nové tabulky a jedna karta.

## Rozsah práce
1. Migrace (tabulky, RLS, realtime) — 1 soubor.
2. `watch-party-card.tsx` (RSVP + realtime) + formulář hosta + zapojení do
   `PersonalizedEventData` — hlavní kus.
3. *(jen pokud se schválí pushe)* `notify_watch_party` + přepínač v profilu,
   `cron.py` (dva pushe), cron-tick podmínka, checklist řádek, pytest.
4. Průchod textů (čeština, hláškový tón).

Odhad: bez pushů půl večera, s pushi jeden pořádný.

## Otevřené otázky
1. **Chceme pushe?** (bod 1 a 2 výš) Nebo stačí, že karta svítí v appce?
2. **Vypisuje se sledovačka pokaždé ručně**, nebo se má vypsat sama ke
   každému galavečeru a admin ji jen zruší, když se nekoná?
3. **„Přijdu s někým“** — stačí jeden host napevno, nebo chceme počet
   (`+1`, `+2`) přes malý stepper?
