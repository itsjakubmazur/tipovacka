# Shape plan — Historie zápasů bojovníka + pozápasové statistiky

Požadavek od tipéra: *„aby když si rozkliknu určitého bojovníka, viděl jsem,
s kým už v OKTAGONU zápasil a jak to dopadlo."* Plus, doobjednáno, statistiky
odehraného zápasu (hity, takedowny, pokusy o submisi) — ty se ukazují až ve
výsledcích po uzávěrce, takže na tipování nemají jak mít vliv.

Zdrojová data jsou ověřená proti reálným odpovědím OKTAGON API stažených
2026-09-11, vzorky leží v `scraper/tests/fixtures/` a testy běží proti nim
(žádný test nesahá na síť).

## Zdroje dat

| Co | Odkud | Hloubka |
| --- | --- | --- |
| Historie zápasů bojovníka | `GET /v1/fights?fighterId={id}` — jeden request, celá historie, bez stránkování | od OKTAGONU 1 (2016) |
| Pozápasové statistiky | `GET https://oktagon.sh12w3.esports.cz/api/export/matches/{esportsId}` | zhruba od poloviny 2024 |

Párování na naše záznamy je přímé: `fighter1.id`/`fighter2.id` z API se rovná
`fighters.oktagon_fighter_id`. Statistiky se párují přes `fights.oktagon_esports_id`
(nově doplňovaný z `metadata.esportsId` na kartě).

### Co API neumí

- **Nemá endpoint pro historii pod `/v1/fighters/{id}`** — `/fights` a `/fighters`
  ano, `/fighters/{id}/fights|history|record` vrací 404.
- **`/v1/fighters/{id}/stats`** (kariérní čísla, finish rate apod.) existuje, ale
  u části bojovníků vrací 404 — vede se v odděleném systému a nejde dopředu
  odhadnout, kdo tam je. Záměrně nepoužito.
- **Profil bojovníka na webu** historii jednotlivých zápasů vůbec neukazuje,
  jen posledních 5 výsledků jako W/L odznaky. Naše appka tím pádem ukáže víc
  než oficiální web.

## Datový model

**Nic z toho nesmí do `fights`/`events`.** Ty dvě tabulky živí bodování,
sezónní žebříček (`season = extract(year from events.event_date)`) i seznam
galavečerů — doimportovat sem OKTAGON 1 z roku 2016 by rozbilo žebříček a
zaplavilo appku eventy, které parta nikdy netipovala.

Migrace `20260745000000_fighter_history_and_fight_stats.sql`:

- `fighter_oktagon_fights` — jeden řádek na (bojovník, zápas), tedy z pohledu
  konkrétního bojovníka. Dotaz na profil je `where fighter_id = ? order by
  event_date desc`, bez OR přes dva sloupce. Soupeř má odkaz do `fighters` jen
  když ho v DB máme; jinak stačí jméno, slug a fotka z API.
- `fight_stats` — agregáty na náš `fights.id`, plus rozpad po kolech v `jsonb`.
  Řídká tabulka: u zápasu, ke kterému statistiky nejsou, prostě řádek není.
- `fighters.oktagon_legacy_id` a `fights.oktagon_esports_id` — klíče do
  externího statistického systému.
- Obě nové tabulky mají **vlastní** trigger funkci na invalidaci cache
  (`fighter-<id>`, resp. event tag přes `fights`), která posílá webhook přes
  sdílené `revalidate_tag()`. Do společné `notify_revalidate()` se sahat nesmí:
  PL/pgSQL u ní typově kontroluje jen tu větev, na kterou dojde řada, a jakmile
  se z IF/ELSIF udělá CASE nebo se přidá odkaz na sloupec, který jiná tabulka
  nemá, přestanou fungovat zápisy do tabulek, kterých se změna vůbec netýká.
  Stálo to jeden výpadek zápisů do `fights` (viz 20260746 a 20260747) — a bylo
  to podruhé, popsané už v hlavičce migrace 20260742.

RLS: čtení pro přihlášené, zápis výhradně service-role klíčem scraperu.
`fight_stats` navíc zrcadlí viditelnost `fights` — nic z karty skrytého (draft)
galavečera.

## Import

| Skript | Kdy běží |
| --- | --- |
| `scraper/import_fighter_history.py --event-id <id>` | po importu karty a po importu výsledků (cron) |
| `scraper/import_fighter_history.py --all` | ručně, jednorázový backfill |
| `scraper/import_fight_stats.py --event-id <id>` | po importu výsledků a při jejich rekontrole (cron) |

Historie stojí jeden request na bojovníka, tedy ~24 na galavečer. Statistiky
jeden request na odehraný zápas. Obojí visí v `cron.py` na `_refresh_fighter_history`
/ `_refresh_fight_stats`, které **výjimku spolknou a jen ji zalogují** — ani
jedno není nic, kvůli čemu by měl spadnout celý tick, a statistiky navíc jedou
z cizí domény bez jakéhokoli závazku vůči OKTAGONu.

## Pasti v datech (všechny ověřené na fixtures)

- **`numRounds` je kolo, ve kterém zápas skončil**, ne naplánovaná délka.
  Holzer vs. Ilbay (OKTAGON 69) má `SUB` / `4:14` / `numRounds: 4` a přitom
  **nebyl titulový** — tenhle případ API neumí vyjádřit vůbec, což je přesně
  důvod, proč má admin ruční volbu počtu kol u zápasu.
- **`time` má dva formáty**: `"3:14"` u novějších zápasů, `"227"` (sekundy)
  u starých. Řeší `parse_end_time()`, nově i pro `result_time` na kartě.
- **Neodehraný zápas nemá klíč `result` vůbec** (ne `null`), což je zároveň
  filtr „co patří do historie".
- **`scoreCards` nejsou spolehlivé** — Holzer vs. Ilbay skončil submisí ve 4.
  kole a má vyplněné karty na 3 kola. Nepoužívají se na nic.
- **Statistiky nejdou párovat pozicí.** Externí systém má vlastní `fighter1`/
  `fighter2` a vlastní id bojovníků; párujeme přes `externalId` (= OKTAGON
  `legacyId`), a když ten chybí (kdokoli podepsaný v posledních dvou letech ho
  nemá), přes jméno. Když nesedí ani jedno, statistiky se **zahodí** — zrcadlově
  prohozená čísla jsou horší než žádná.
- `hits` se počítají jako doručené zásahy; položka s `result: "defended"` se
  nepočítá. V reálných vzorcích se jiná hodnota než `"landed"` nevyskytla, ale
  název pole napovídá, že existovat může.

## UI

**1. Bilance a forma v „Bio" panelu karty zápasu** (`fight-tip-card.tsx`).
U každého bojovníka řádek `V OKTAGONU 4-1` a posledních pět zápasů jako
bublinky V/P/R, s popiskem soupeře a způsobu ukončení v `title`. Panel se nově
otevírá i bojovníkům, kteří nemají bio — bilance a forma jsou to, kvůli čemu
ho lidi rozbalují.

**2. Detail bojovníka jako modal** (`components/fighters/fighter-sheet.tsx`).
Vstup je **jméno v Bio panelu**, ne fotka v matchupu: tam je celá polovina
karty tipovací tlačítko a druhý cíl vedle něj by šel proti „rychlost tipování
nad vším". Uvnitř foto, ranking, kariérní i oktagonní bilance, bio a **celá
historie zápasů** — víc, než ukazuje oficiální profil na oktagonmma.com.
Historie se dotahuje až při otevření, ne s kartou: deset karet na mobilu by
jinak s sebou táhlo dvě stovky řádků, na které se nikdo nedívá. Stojí na
sdílené `components/modal.tsx` (focus trap, Escape), která kvůli tomu dostala
nepovinné `onClose` — modal otevřený z karty nemá vlastní routu, kam by se dalo
vrátit.

**3. Odveta.** Když spolu už dva bojovníci v OKTAGONU nastoupili, karta má
v hlavičce odznak *Odveta* a v Bio panelu větu „Už se potkali. OKTAGON 81:
vyhrál Kincl (na body)". Hledá se v historii strany A podle OKTAGON id soupeře,
**jen v galavečerech starších než tenhle** — po odzápasení je totiž dnešní
zápas sám v historii obou a karta by se jinak hlásila jako odveta sama na sebe.

**4. Pozápasové statistiky** (`components/fights/fight-stats-panel.tsx`) jako
druhý přepínač „Statistiky" v patičce karty, vedle „Bio". Čtyři řádky (zásahy,
tvrdé zásahy, takedowny, pokusy o submisi) jako dvojice pruhů rostoucích od
středu ke své straně, s čísly jako přímými popisky. Zobrazí se jen tehdy, když
k zápasu data vůbec jsou — a ta vznikají až po odzápasení.

Barvy: značková žlutá proti modré, tedy stejná dvojice, jakou appka používá pro
dva bojovníky jinde. Validátor palety hlásí u té dvojice odstup ΔE 46 (protanopie)
a 52 (normální vidění), tedy hluboko nad prahem rozlišitelnosti; band check
lightness neprojde a neprojde s žádnou použitelnou žlutou proti modré, takže je
to vědomá odchylka. Identitu navíc nese strana pruhu a jméno nad ním, ne jen barva.

Per-round rozpad statistik se ukládá (`fight_stats.rounds`), ale zatím se
nikde nezobrazuje — v kartě zápasu na mobilu by to byla zeď čísel.
