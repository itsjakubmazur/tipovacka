# Historie zápasů bojovníka v OKTAGON API — průzkum

Cíl: najít zdroj, odkud jde vytáhnout kompletní historii zápasů konkrétního
bojovníka (s kým zápasil a jak to dopadlo), aby šlo párovat na naše záznamy
přes `oktagon_fighter_id`. **Nic v `src/` ani ve scraperu se neměnilo** — jde
čistě o zápisky z průzkumu + fixtures v `scraper/tests/fixtures/oktagon_fighter_history/`.

Všechny požadavky šly s `User-Agent` z `scraper/oktagon.py` (běžný Chrome UA).
Testováno 2026-09-11.

## TL;DR

**Existuje.** `GET /v1/fights?fighterId={id}` vrací kompletní historii zápasů
daného bojovníka v rámci OKTAGON/FABRIQ — žádné stránkování není potřeba,
vrací se rovnou vše (u testovaného bojovníka od roku 2016 dodnes, 16 položek
jedním requestem). `/v1/events/` + `/v1/events/{id}/fightcard` samy o sobě na
dopočítání historie **stačí taky**, ale je potřeba projít všechny eventy a
filtrovat fightcards podle `fighter.id` — `/v1/fights?fighterId=` dělá přesně
tohle za nás na serveru.

## Cesta → HTTP kód → co vrací

| Cesta | HTTP | Co vrací |
| --- | --- | --- |
| `GET /v1/fights?fighterId={id}` | **200** | **Použitelné.** Pole všech zápasů daného bojovníka (viz níže), nejnovější první, včetně nadcházejícího nerozhodnutého zápasu (`result: null`) i historických s plným výsledkem. Bez limitu/stránkování — vrátilo se vše. |
| `GET /v1/fighters/{id}` | 200 | Detail bojovníka (jméno, vážová kategorie, `scores.MMA_PROFI` = souhrnné V-P-R za **celou profi kariéru**, ne jen OKTAGON) — **bez seznamu jednotlivých zápasů**. |
| `GET /v1/fighters/{slug}` | 200 | Totéž jako výše, `id` i `slug` fungují zaměnitelně jako identifikátor v cestě. |
| `GET /v1/fighters/` | 200 | Stránkovaný seznam bojovníků (výchozí 20 položek), stejný tvar jako detail jednoho — opět bez historie zápasů. |
| `GET /v1/fights/` | 200 | Flat seznam zápasů napříč celým OKTAGONem (výchozí stránka ~20 položek, nejnovější/nejbližší nahoře) — použitelné jako generický "poslední/nadcházející zápasy" feed, ne pro historii jednoho bojovníka. |
| `GET /v1/events/?limit=150` | 200 | **Kompletní** seznam eventů, `oktagon-1` (2016-12-10) až po nejnovější ohlášené (2027). Vrátilo se 145 položek jedním requestem. |
| `GET /v1/events/{id}/fightcard` | 200 | Pole "cards" (váhové skupiny) → `fights[]`; u odehraných zápasů obsahuje `result`, `resultType`, `time`, `numRounds` (viz sekce Pole níže). Funguje i pro `id` z roku 2016. |

### Co NEJDE (vyzkoušeno, vrátilo 404/400)

| Cesta | HTTP | Poznámka |
| --- | --- | --- |
| `GET /v1/fighters/{id}/fights` | 404 | |
| `GET /v1/fighters/{id}/history` | 404 | |
| `GET /v1/fighters/{id}/record` | 404 | |
| `GET /v1/fighters/{id}/opponents` | 404 | |
| `GET /v1/fighters/{id}/events` | 404 | |
| `GET /v1/athletes/{id}` | 404 | |
| `GET /v1/fighter/{id}` | 404 (jednotné číslo) | |
| `GET /v1/results/` | 404 | |
| `GET /v1/fights/?fighter=678` | 400 | Špatný název parametru — musí být `fighterId`, ne `fighter`. |
| `GET /v1/events/?fighterId=678` | 400 | Filtr podle bojovníka na `/events/` nejde, jen na `/fights/`. |
| `GET /v1/events/?page=2` / `?offset=20` / `?take=50` | 400 | Tyhle názvy parametrů API nezná. |
| `GET /v1/events/?limit=500` | 400 | Limit nad ~200 je odmítnutý (viz Stránkování). |
| `GET /v1/fights?fighterId=385&organizationIds=OKTAGON_MMA` | 400 `"organizationIds must be an array"` | Musí být `organizationIds[]=OKTAGON_MMA` (array syntaxe), viz níže. |

## `/v1/fights?fighterId={id}` — pole v odpovědi (z pohledu daného bojovníka)

Každá položka pole je jeden zápas. Klíčová pole:

- `fighter1`, `fighter2` — kompletní objekty obou bojovníků (jméno, `id`,
  `slug`/`slugs`, národnost, aktuální ranking, foto...). **Soupeře** zjistíš
  tak, že vezmeš toho, jehož `id` **není** rovné požadovanému `fighterId`.
- `result` — `"FIGHTER_1_WIN"` / `"FIGHTER_2_WIN"` / `"DRAW"` /
  `"NO_CONTEST"` / **chybí (`null` klíč vůbec není v objektu)** u zápasu,
  který se ještě neodehrál. Výsledek **z pohledu konkrétního bojovníka**
  dostaneš porovnáním, jestli byl `fighter1` nebo `fighter2`.
- `resultType` — `"KO"` / `"TKO"` / `"SUB"` / `"DEC"`, jen u rozhodnutých
  zápasů (`DRAW`/`NO_CONTEST` ho nemají).
- `time` — čas zastavení v posledním kole. **Pozor, formát není jednotný**:
  u novějších zápasů `"3:14"` (M:SS string), u některých starých (viz
  `fightcard_oktagon-1_sample.json`, rok 2016) je to počet sekund jako číslo
  (`227`). Je potřeba počítat s oběma tvary.
- `numRounds` — navzdory názvu to **není** počet naplánovaných kol, ale
  **kolo, ve kterém zápas skončil** (u DEC = poslední odehrané kolo = shodné
  se scheduled délkou, protože se šlo do konce). Ověřeno srovnáním v rámci
  jedné fightcard: finishe v 1. kole mají `numRounds: 1`, DEC na 3 kola má
  `numRounds: 3`, DEC na titulový zápas na 5 kol má `numRounds: 5`.
- `titleFight` — bool.
- `event` — vnořený objekt eventu (`id`, `slug`/`slugs` typu
  `"oktagon-88-hannover"`, `startDate`, vícejazyčný `title`) — odsud se dá
  přečíst **číslo/název galavečera**.
- `weightClass` — váhová kategorie, ve které se zápas odehrál (může se lišit
  od aktuální "domovské" váhovky bojovníka v `/v1/fighters/{id}`).
- `scoreCards` — u zápasů na body (`resultType: "DEC"`) pole karet
  jednotlivých rozhodčích (`judgeName`, body po kolech). U finishů `null`
  nebo úplně chybí.
- `refereeName` — jméno rozhodčího v kleci (u starších zápasů nemusí být).

Ukázka reálných (zkrácených) dat: `fights_by_fighterId_max-holzer.json` a
`fights_by_fighterId_patrik-kincl.json` (druhý navíc obsahuje `scoreCards`).

## Hloubka historie a stránkování

- `/v1/events/` bez parametrů: posledních/nejbližších ~20 eventů (viz
  docstring v `oktagon.py`).
- `/v1/events/?limit=N`: **funguje**, ale je stropovaný — `limit=150` i
  `limit=200` obě vrátily **stejných 145 položek** (= úplně všechny eventy,
  co OKTAGON kdy měl v systému, včetně budoucích ohlášených). `limit=500`
  a víc vrací `400`. Reálný strop je tedy někde mezi 200 a 500, ale je to
  jedno — 150/200 už stačí na **celou historii** (nejstarší je `oktagon-1`,
  2016-12-10).
- Parametry `page`, `offset`, `take` na `/v1/events/` **neexistují** (400).
  Jediný funkční doplňkový parametr je `skip` (`?skip=20` vrátilo 200), ale
  vzhledem k tomu, že `limit=150` už vrátí úplně vše, není potřeba ho použít.
- `/v1/fights?fighterId={id}` **nemá vlastní stránkování ani limit** — u obou
  testovaných bojovníků (7 zápasů od 2024, 16 zápasů od 2016) vrátil jedním
  requestem kompletní historii. Nejde vyloučit, že extrémně aktivní
  bojovník (desítky zápasů) by mohl narazit na nějaký interní strop, ale
  v testovaných datech se žádný neprojevil.
- API navíc přijímá i bohatší filtry — `organizationIds[]` (pozor, musí být
  array syntaxe, ne `organizationIds=X`), `startDateAfter`/`startDateBefore`
  (ISO datum), `limit`, `sort` (`[{key, direction}]`). Zjištěno z toho, co
  na pozadí volá samotný web (viz sekce Web níže) — pro naše účely stačí
  ale samotné `fighterId`, protože bez omezujících parametrů vrací vše.
- U jednoho **dávno odehraného** eventu (`oktagon-1`, 2016-12-10,
  `/v1/events/11/fightcard`) je ověřeno, že `result`/`resultType`/`time`/
  `numRounds` jsou vyplněné stejně jako u nedávných — viz
  `fightcard_oktagon-1_sample.json`.

## Web (oktagonmma.com) — co jsem zkoušel v Chromu

Playwright nebyl v prostředí nainstalovaný; místo instalace nového balíčku
jen pro jednorázový průzkum jsem použil Chrome rozšíření (claude-in-chrome),
které dává stejnou viditelnost (headed prohlížeč + zachycené síťové
požadavky).

- Uhodnutá URL `oktagonmma.com/cs/fighter/max-holzer` (jednotné číslo)
  **neexistuje** — vrátí prázdnou stránku bez obsahu. Správný tvar, zjištěný
  proklikáním přes nav **Bojovníci → karta bojovníka**, je
  `oktagonmma.com/cs/fighters/{slug}/` (množné číslo, se slugem, koncové
  lomítko).
- **Profil bojovníka historii jednotlivých zápasů NEUKAZUJE** — jen souhrnné
  skóre (V-P-R), pár statistik (% ukončení, % výher na body, % signifikantních
  úderů) a **posledních 5 zápasů jako pouhé W/L odznaky** (bez soupeře, data
  nebo způsobu ukončení). Screenshot: `docs/oktagon-fighter-profile-web.jpg`
  (Patrik Kincl — vidět řada `W W L L W` / "POSLEDNÍCH 5 ZÁPASŮ").
- Odkud ta W/L data tečou: stránka je Next.js SSR, takže z prohlížeče nejde
  vidět XHR na `api.oktagonmma.com` přímo — data se natahují na serveru a
  do prohlížeče přijdou už hotová v `_next/data/<buildId>/cs/fighters/
  <slug>.json?id=<slug>` (zachyceno i jako prefetch při najetí myší na kartu
  bojovníka v seznamu `/cs/fighters/`). Tenhle JSON obsahuje "dehydrovaný"
  React Query stav s 5 dotazy, mj.:
  - `['fights', 'list', {fighterId, organizationIds: ['OKTAGON_MMA'],
    startDateBefore: <dnešek>, limit: 5, sort: [...]}]` — přesně těch 5
    zápasů co se ukazují jako W/L odznaky. Tzn. **UI si vědomě omezuje
    dotaz na posledních 5** — API samo o sobě žádný takový strop nemá
    (viz výše, `fighterId` bez `limit` vrátí vše).
  - `['statistics', 'fighter', <id>]` — bonus endpoint, který jsem
    nezkoumal do hloubky (mimo scope úkolu), vrací agregované statistiky
    (počty way ukončení, procenta zásahů apod.), ne historii zápas-po-zápasu.
  - Ukázka celého dehydrovaného stavu (zkráceně):
    `nextjs_ssr_fighter-profile-queries_patrik-kincl.json`.
- Tahle interní query (s `organizationIds`/`startDateBefore`/`limit`/`sort`)
  jde poslat i přímo na `api.oktagonmma.com/v1/fights` a funguje stejně
  (ověřeno curlem) — je to tedy stejné API, jen web posílá bohatší filtr,
  než potřebujeme my.

## Párování na naše záznamy

Přímé — `fighter1.id`/`fighter2.id` z `/v1/fights?fighterId=` i z
`/v1/events/{id}/fightcard` odpovídá `oktagon_fighter_id` v DB, `slug`
odpovídá `oktagon_slug`. Soupeře i výsledek z pohledu "našeho" bojovníka jde
odvodit čistě porovnáním `id` v `fighter1`/`fighter2` s tím, koho hledáme —
žádné další mapování není potřeba.

## Co by šlo napsat jako importér (mimo scope tohoto průzkumu)

Pro daný `oktagon_fighter_id`: `GET /v1/fights?fighterId={id}`, pro každou
položku s vyplněným `result` vzít `event.slug`/`event.startDate` (galavečer),
soupeře (druhý `fighter{1,2}`), `resultType`, `time` (ošetřit oba formáty),
`numRounds` (= kolo ukončení) a `outcome` odvozený porovnáním `result` se
slotem (`fighter1`/`fighter2`), ve kterém náš bojovník figuruje.
