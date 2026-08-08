# Design backlog — impeccable run

Sestaveno z `docs/critique-notes.md` + `docs/audit-notes.md` +
`.impeccable/detect-baseline.json`. Prioritizováno podle dopadu na uživatele
(parta ~10 lidí, mobil, špička před uzávěrkou) a rizika změny.

Sloupec **Riziko** říká, jestli se položka dá bezpečně opravit jako čistě
vizuální/kopírovací změna, nebo jestli se dotýká herní logiky (bodování,
uzávěrky, realtime) — takové položky NEJDOU do implementace bez výslovného
schválení, viz sekce „Otázky k BRÁNĚ B" na konci.

## P0 — blokující

| # | Obrazovka | Problém | Dopad | Riziko |
|---|-----------|---------|-------|--------|
| B-1 | Fight card / uzávěrka | Countdown na nule nezamkne UI klientsky — uživatel může ťukat po uzávěrce, dostane matoucí chybu při uložení | Vysoký — přímo při deadline, kdy je appka nejvíc používaná | **Herní logika (uzávěrka) — NESAHAT bez schválení, viz otázka Q1** |

## P1 — velké

| # | Obrazovka | Problém | Dopad | Riziko |
|---|-----------|---------|-------|--------|
| B-2 | Seznam eventů | "Uzamčeno" a "Vyhodnoceno" mají identický šedý badge — nelze rozlišit stav | Střední-vysoký, zmatek při rychlém skenu | Vizuální — bezpečné |
| B-3 | Seznam eventů | Hero slot vázán na pořadí pole, ne na `primaryEventId`/`liveEvent` | Střední, může vypadat rozbitě v edge case | Vizuální/logika výběru — bezpečné (jen která karta je hero, ne herní data) |
| B-4 | Fight card | Digit-roll countdown boxy nejsou glass — porušuje vlastní design systém v nejviditelnějším momentu | Střední, konzistence | Vizuální — bezpečné |
| B-5 | Fight card | Dvě redundantní "skoč na netipovaný zápas" UI na mobilu zároveň | Střední, vizuální šum ve stresu | Vizuální/interakce — bezpečné |
| B-6 | Leaderboard | `RankMedal` ikona bez `aria-hidden`, duplicitní ohlášení pro screen reader | Nízký-střední (dotýká se malé části publika, ale reálný a11y bug) | Vizuální/a11y — bezpečné |
| B-7 | Detail tipů ostatních | `BackLink` v modalu dělá tvrdou navigaci místo zavření overlaye | Střední, rozbíjí interakční model | Vizuální/interakce — bezpečné |
| B-8 | Detail tipů ostatních | Hráč bez tipů vidí prázdnou stránku bez vysvětlení | Střední, vypadá jako bug | Vizuální/copy — bezpečné |
| B-9 | Profil | Nekonzistentní `Section` wrapping u nickname/heslo formulářů | Nízký-střední, konzistence skenování | Vizuální — bezpečné |
| B-10 | Profil | Validace čísla účtu jen při submitu, ne za psaní | Střední — reálné peníze mezi kamarády | Formulářová validace na klientu — bezpečné (nemění zápis do DB, jen dřívější feedback) |

## P2 — menší

| # | Obrazovka | Problém | Dopad | Riziko |
|---|-----------|---------|-------|--------|
| B-11 | Seznam eventů | Prázdný stav není glass surface | Nízký | Vizuální — bezpečné |
| B-12 | Fight card | Bold pick (jistotka) tiše osiří při zrušení zápasu po uzávěrce, bez vysvětlení ztráty bodů | Nízký-střední, matoucí, ale vzácný edge case | **Herní logika (bodování jistotky) — NESAHAT bez schválení, viz otázka Q2** |
| B-13 | Fight card | `Pill` tlačítka bez `aria-pressed` | Nízký (a11y) | Vizuální/a11y — bezpečné |
| B-14 | Leaderboard | Scoring legenda defaultně sbalená, těžko objevitelná pro nováčka | Nízký-střední (onboarding) | Vizuální/copy — bezpečné |
| B-15 | Leaderboard | Podium se nezobrazí při <3 hráčích, bez náhradní zprávy | Nízký | Vizuální — bezpečné |
| B-16 | Detail tipů ostatních | Přímý odkaz `/leaderboard/u/[userId]` bez `loading.tsx` | Nízký | Vizuální — bezpečné |
| B-17 | Detail tipů ostatních | Hardcoded `text-blue-500` místo Glass Blue tokenu | Nízký | Vizuální — bezpečné |
| B-18 | Profil | Placeholder čísla účtu vypadá jako reálná hodnota | Nízký | Copy — bezpečné |
| B-19 | Profil | Nickname se neořezává (whitespace-only projde) | Nízký | Validace na klientu — bezpečné |
| B-20 | Audit | `event-comments.tsx:498` — šedý text na červeném pozadí (kontrast) | Nízký | Vizuální — bezpečné |
| B-21 | Audit | `wrapped-player.tsx:118` — animace `width` místo transform (layout thrash) | Nízký (jen na `/wrapped`, jednou ročně) | Vizuální/výkon — bezpečné |
| B-22 | Audit | `back-link.tsx` bez `focus-visible` stylu | Nízký (a11y) | Vizuální — bezpečné |

## P3 — leštění

| # | Obrazovka | Problém | Dopad | Riziko |
|---|-----------|---------|-------|--------|
| B-23 | Seznam eventů | "Tipnuto X z Y" jen text, ne progress bar | Kosmetický | Vizuální — bezpečné |
| B-24 | Leaderboard | Konfety při 1. místě na každý load, ne jen napoprvé | Kosmetický | Vizuální — bezpečné |
| B-25 | Detail tipů ostatních | Pre-lock zpráva bez glass containeru | Kosmetický | Vizuální — bezpečné |
| B-26 | Profil | `change-password-form` neresetuje "Heslo změněno." při editaci confirm pole | Kosmetický | Vizuální — bezpečné |
| B-27 | Audit | Bounce/elastic easing na 4 místech (install prompt, tip-check) — detektor to značí jako "slop", ale je to záměrné pro playful arrival | Kosmetický, stylová volba | Vizuální — bezpečné, ale viz otázka Q3 (chceme to měnit?) |
| B-28 | Audit | 43 "color outside DESIGN.md" nálezů — většina jsou legitimní alpha odstíny glass systému, ne skutečný drift | Žádný (formát tokenů to nedokáže pojmout) | Dokumentační — navrhuji ignorovat/nezahrnout do práce na obrazovkách |
| B-29 | Audit | `og-card.tsx`/`share/podium` používá Inter font a radius mimo DESIGN.md | Nízký — týká se jen generovaných share obrázků, ne appky samotné | Vizuální — mimo scope 7 schválených obrazovek, navrhuji odložit |

## Otázky k BRÁNĚ B

1. **Q1 (B-1, P0)**: Countdown na nule nezamyká UI klientsky. Oprava vyžaduje
   zásah do logiky uzávěrky (lokální zámek karty při dosažení nuly / vynucený
   reload). Chceš, abych to opravil, nebo to necháme mimo scope tohohle designového
   běhu a předáme jako bug ticket mimo `/impeccable`? (Doporučení: opravit — je
   to P0 a přímo v bezpečnostních mantinelech řešeno jako "nesahat bez jistoty",
   ale tady jde spíš o chybějící klientský stav než o změnu pravidel bodování/uzávěrky.)
2. **Q2 (B-12, P2)**: Jistotka (bold pick) osiří beze zprávy při zrušení zápasu
   po uzávěrce — bodový dopad zůstává nezměněný, jde jen o chybějící UI
   vysvětlení. Chceš přidat jen vysvětlující UI (bez dotyku výpočtu bodů), nebo
   nechat mimo scope? (Doporučení: přidat UI vysvětlení, nedotýkat se výpočtu.)
3. **Q3 (B-27, P3)**: Bounce/elastic easing detektor označuje jako "slop", ale
   je to záměrná "arrival with overshoot" animace (install prompt, potvrzení
   tipu). Ponechat, nebo vyměnit za exponenciální easing? (Doporučení: ponechat
   — je to podložené vlastním komentářem v kódu jako záměr, ne omyl.)

## Navrhuji vyhodit ze scope tohohle běhu

- B-29 (share/og-card font a radius) — mimo 7 schválených obrazovek.
- B-28 (43 color-outside-design.md nálezů) — formátové omezení tokenů, ne bug.
