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
- Obě nové tabulky jsou v revalidačním triggeru (`fighter-<id>`, resp. event tag
  přes `fights`), takže se cache po importu zneplatní sama.

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

## UI — zatím nepostavené

Datová vrstva je hotová a nezávislá na tom, jak se to nakonec ukáže. Plán:

1. **V „Bio" panelu karty zápasu** (`fight-tip-card.tsx`) jeden řádek na
   bojovníka: bilance v OKTAGONU (`4-1`) a posledních pět zápasů jako W/L
   bublinky. Rychlý signál při tipování, jeden řádek navíc.
2. **Detail bojovníka jako modal** — kliknutí na jméno/foto v matchupu.
   Appka na to má precedens u detailu tipujícího (`src/app/leaderboard/@modal/(.)u/`
   nad `src/components/modal.tsx`). Tam patří bio, tape a celá historie zápasů.
   Cpát pět řádků historie za oba bojovníky do rozbalovacího panelu uvnitř
   karty znamená na mobilu kartu na dvě obrazovky — proti principu „rychlost
   tipování nad vším".
3. **Pozápasové statistiky** až do výsledkové části zápasu (`fight-matchup.tsx`
   po odzápasení), ne do tipovací karty. Vždy s tichým fallbackem „data nejsou".
4. **Odveta** — když oba bojovníci nadcházejícího zápasu sdílí `oktagon_fight_id`
   v historii, karta umí říct „Odveta — v OKTAGONU 81 vyhrál Kincl na body".
   Jeden dotaz, a pro tipování cennější než celá historie.
