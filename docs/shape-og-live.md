# Shape plán — Sledovačka („OG live“)

Návrh, ne schválený scope. Admin u galavečera zapne, že se kouká u Rejdoše
v garáži; tipéři zaznačí, jestli dorazí a jestli sami. Cílem je **logistika,
ne nová herní mechanika** — do bodů, uzávěrek ani žebříčků se nesahá
(produktový princip 5) a docházka se nikam dál nepočítá.

## Job a publikum
Parta ~10 lidí, 90 % na mobilu. Dnes se domlouvá „kdo dorazí“ v kecárně nebo
mimo appku a nikdo nemá přehled, kolik lidí přijde a kolik piv koupit. Job:
**do jednoho klepnutí odpovědět a na jednom místě vidět, kolik nás bude.**

Jméno v UI: **Sledovačka** (appka se jmenuje OKTAGON GARÁŽ, „OG live“ by
znělo jako další produktová značka).

## Zadaná rozhodnutí
- Zapnout sledovačku může **jen admin nebo superadmin**, v nastavení
  galavečera — **nekoná se pokaždé**, výchozí stav je vypnuto.
- **Vždycky garáž u Rejdoše**, nikde jinde — místo není pole ve formuláři,
  je to konstanta. Žádné adresy, mapy ani víc sledovaček na jeden galavečer.
- Čtyři odpovědi: **Přijdu sám / Přijdu s někým / Možná / Ne**.
- Karta musí být na mobilu **nahoře**, ne až pod fight cardou.
- **Žádné pushe.** Kdo bude chtít, označí se v appce.
- Docházka se **nepočítá** do wrapped ani do statistik.

## Datový model

Protože je sledovačka nejvýš jedna na galavečer, vždycky na stejném místě a
zapíná ji admin, není to vlastní entita — je to **nastavení galavečera**.
Tři sloupce na `events` plus jedna tabulka na odpovědi:

```sql
alter table public.events
  add column if not exists watch_party_enabled boolean not null default false,
  -- null = "od začátku galavečera" (bere se events.lock_at)
  add column if not exists watch_party_starts_at timestamptz,
  add column if not exists watch_party_note text
    check (watch_party_note is null or char_length(watch_party_note) <= 500);

create table public.watch_party_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  -- kolik lidí navíc přivedu; 0 = "přijdu sám", 1+ = "přijdu s někým"
  plus_ones integer not null default 0 check (plus_ones between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
```

Co tím padá:
- **Žádná nová admin RLS politika.** Zápis do `events` už hlídá existující
  `events_admin_write` z `20260618000000_init.sql` (`is_admin`), a stránka
  `/admin/events/[id]` pouští dovnitř `is_admin || is_superadmin`
  (`src/app/admin/events/[id]/page.tsx:31`). Přesně ta skupina, co má
  sledovačku zapínat — nic se nevymýšlí znovu.
- **Žádné nové cache drátování.** `events` už v revalidačním triggeru je
  (`20260741000000_revalidation_webhooks.sql`), takže zapnutí sledovačky
  samo zneplatní cache detailu galavečera.
- Místo je konstanta v kódu (`WATCH_PARTY_PLACE = "Garáž u Rejdoše"`), takže
  se nedá omylem přepsat a nedá se z ní stát pole, které by někdo vyplňoval.

Čtyři segmenty v UI se mapují na dva sloupce: **Přijdu sám** = `yes`/`0`,
**Přijdu s někým** = `yes`/`1`, **Možná** = `maybe`, **Ne** = `no`. Součet
„kolik nás bude“ je pak jeden dotaz (`sum(1 + plus_ones) where answer = 'yes'`)
místo počítání enum hodnot.

### RLS pro odpovědi
- select: `auth.uid() is not null` (celá appka je stejně za auth gate
  v `src/proxy.ts`; účast je uvnitř party veřejná, viz Soukromí).
- insert/update/delete: `auth.uid() = user_id`, delete navíc admin (úklid).
- Tabulku přidat do publikace `supabase_realtime` (stejný `do $$` blok jako
  v migraci `20260712000000_event_comments.sql`).

## Zapnutí (admin)

Do `src/components/admin/event-settings-form.tsx`, hned k přepínači startovného
(řádek 191–196), přibude druhý checkbox **„Sledovačka v garáži u Rejdoše“**.
Když je zapnutý, rozbalí se pod ním dvě nepovinná pole: **od kdy** (prázdné =
od začátku galavečera, přes `pragueLocalToUtcIso` z `src/lib/time.ts`) a
**poznámka** („vem si pití, gril je můj“). Zápis jde stejným `update` na
`events` jako zbytek formuláře (řádek 99–108) — jedno uložení, žádná nová
obrazovka, žádná další server akce.

Vypnutí přepínače sledovačku schová. Odpovědi se **nemažou** — když ji Rejdoš
omylem vypne a zapne, nikdo nepřichází o to, co už naklikal.

## UI v detailu galavečera

Karta `.glass-surface` jde **hned pod `EventStatusTimeline`**, tzn. do
`src/components/events/personalized-event-data.tsx` kolem řádku 217.

To je přesně to „nahoře“: `<aside>` má na mobilu `className="contents"`
(řádek 169), takže celý přehledový sloupec je v DOM **před** fight cardou a
na mobilu se vykreslí nad ní. Karta tak sedí jako druhý blok shora, hned pod
odpočtem — a na desktopu nahoře v pravém sticky sloupci.

Obsah karty:
- Hlavička: „SLEDOVAČKA“ + „Garáž u Rejdoše“ + čas.
- Poznámka od Rejdoše, pokud nějakou napsal.
- Odpověď: `SegmentedControl` (`src/components/ui/segmented-control.tsx`) se
  čtyřmi segmenty, vybraný `.glass-accent` (Lit-Not-Flat pravidlo z DESIGN.md).
  Na úzkém mobilu se čtyři plné popisky nevejdou — segmenty jsou zkrácené
  („Sám / S někým / Možná / Ne“) s plným `title` pro čtečky.
- Souhrn: „**Bude nás 9** · 7 dorazí (+2) · 2 možná · 1 ne“ a pod tím jména.
- Zápis optimisticky, realtime na `watch_party_rsvps` dorovná ostatní.

Stavy:
- **Vypnutá sledovačka**: nezobrazí se nic, nikomu — ani prázdné místo nad
  fight cardou. Tohle je výchozí stav většiny galavečerů.
- **Neodpovězeno**: segmenty prázdné. Karta je první věc pod odpočtem,
  nepotřebuje se dovolávat pozornosti navíc.
- **Po vyhodnocení**: karta se smrskne na jeden řádek „V garáži nás bylo 9“.

Mimo scope v1: badge v seznamu galavečerů (`src/lib/data/events-list.ts` je
cachovaný — zapnutí sledovačky sice cache zneplatní, ale počet odpovědí ne;
chtělo by to do triggeru přidat `watch_party_rsvps` a do `extraTagsForTable`
tag `events-list`) a propojení s `WatchingNow` presencí („5 z 9 už je
v garáži“).

## Cache
Nastavení sledovačky je na `events`, takže žije v cachovaném shellu
(`getEventShared`) a invaliduje se samo. **Odpovědi** se renderují uvnitř
`PersonalizedEventData`, což je necachovaná půlka detailu — na
`notify_revalidate` ani `extraTagsForTable` se tedy v1 nesahá vůbec.

## Notifikace
Žádné. Sledovačka se ohlásí tím, že je v appce nahoře na detailu galavečera,
kam parta stejně před uzávěrkou chodí kvůli tipům. Nepřibývá tím ani push
kind, ani přepínač v profilu, ani řádek v admin checklistu, ani podmínka
v `findPendingWork()` — `scraper/` se tahle feature netýká.

## Soukromí
Adresa nikde není (garáž zná každý), takže není co chránit před zamčenou
obrazovkou telefonu.

Jména účastníků vidí všichni — schválně naopak než `WatchingNow`, kde je
komentář o tom, že seznam koukajících je sledování. Rozdíl: RSVP je
dobrovolné a akční, člověk ho dělá právě proto, aby ostatní věděli.

## Co zůstává nedotčené
`calculate_points`, uzávěrky, `event_leaderboard` / `season_leaderboard`,
predictions RLS, scraper, pushe, revalidační trigger. Feature je čistě
aditivní: tři sloupce, jedna tabulka, jeden checkbox, jedna karta.

## Rozsah práce
1. Migrace (sloupce na `events`, tabulka odpovědí, RLS, realtime) — 1 soubor.
2. Checkbox + dvě pole v `event-settings-form.tsx`.
3. `watch-party-card.tsx` (RSVP + realtime) + zapojení do
   `PersonalizedEventData` — hlavní kus.
4. Průchod textů (čeština, hláškový tón) + vitest na pomocné funkce
   (skloňování „bude nás 9“, mapování čtyř segmentů na `answer`/`plus_ones`).

Odhad: půl večera.

## Otevřené otázky
1. **„Přijdu s někým“** — stačí jeden host napevno (`+1`), nebo chceš počet
   přes malý `+`/`−` (`+2`, `+3`)?
2. **Kdy karta zmizí** — hned po vyhodnocení galavečera, nebo ať tam řádek
   „v garáži nás bylo 9“ zůstane natrvalo jako vzpomínka?
