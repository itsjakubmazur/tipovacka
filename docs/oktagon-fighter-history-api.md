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

## Dodatek: další statistiky z profilu (finish %, výhry na body, sig. údery)

Doplněno na základě dotazu, kam by šlo v appce zapracovat i další čísla,
která web u bojovníka ukazuje vedle "posledních 5 zápasů" — "PROCENTO
UKONČENÍ", "VÝHRY NA BODY", "SIGNIFIKANTNÍ ÚDERY" (viz
`docs/oktagon-fighter-profile-web.jpg`).

### Odkud ta čísla jdou

Jiný zdroj než historie zápasů výše — v `_next/data/.../cs/fighters/
<slug>.json` je vedle `['fights', 'list', ...]` ještě dotaz
`['statistics', 'fighter', <id>]`, jehož `highlights` objekt obsahuje přesně
tahle čísla (ověřeno na Patriku Kinclovi, hodnoty sedí 1:1 se screenshotem):

```json
{
  "highlights": {
    "finishRate": 50,
    "finishEndTypePercentageWins": { "decision": 50, "technical_knockout": 17, "submission": 33, ... },
    "hitTypePercentage": { "significant": 53, "insignificant": 47 },
    "hitResultPercentage": { "landed": 100, "defended": 0 },
    "lastFightsResults": ["W", "W", "L", "L", "W", "W", "W", "W"]
  },
  "matchCount": 8, "winCount": 6, "lossCount": 2, "drawCount": 0,
  "endTypeCount": { ... }, "endTypeCountWins": { ... }, "endTypeCountLosses": { ... },
  "hitTypeCount": [...], "hitResultCount": [...], "hitTargetCount": [...]
}
```

Mapování na UI štítky:

| Štítek na webu | Pole |
| --- | --- |
| PROCENTO UKONČENÍ | `highlights.finishRate` |
| VÝHRY NA BODY | `highlights.finishEndTypePercentageWins.decision` (% ze všech výher, co byly na body) |
| SIGNIFIKANTNÍ ÚDERY | `highlights.hitTypePercentage.significant` |
| POSLEDNÍCH 5 ZÁPASŮ (W/L odznaky) | prvních 5 z `highlights.lastFightsResults` (pole je řazené **od nejnovějšího**) |

Plná odpověď (i s rozpadem podle kola — `hitTypeCount`/`hitResultCount`/
`hitTargetCount` po kolech, hlava/tělo/nohy) je jen v `highlights` a nad ním
agregovaná struktura pro celou kariéru — tohle vypadá jako jediný zdroj
těchto konkrétních čísel, žádná náhrada se nenašla.

**Přesná REST cesta na `api.oktagonmma.com` se nepodařilo ověřit** (na rozdíl
od `/v1/fights` výše, který je potvrzený). Vyzkoušené tvary vrátily 404
(`/v1/statistics/fighter/{id}`, `/v1/fighters/{id}/statistics`,
`/v1/fighter-statistics/{id}`, `/v1/fighters/{id}/highlights`) — jedna cesta,
`/v1/fights/statistics`, evidentně existuje (vrací 400 misto 404), ale
nenašel jsem správný formát parametrů (`fighterId`/`fighterIds` ani prosté,
ani jako pole nesedí — pořád `"Validation failed (numeric string is
expected)"`). Je to vedlejší zjištění, ne blokující: **"posledních 5
zápasů" umíme spočítat sami** z dat, co už stahujeme přes `/v1/fights?
fighterId=` (viz sekce výše) — netřeba kvůli tomu tenhle endpoint řešit.
Pro finish %/výhry na body %/signifikantní údery % by ale bylo potřeba buď
dohledat správný tvar téhle cesty (další kolo zkoušení parametrů), nebo to
brát přímo z `_next/data/.../cs/fighters/<slug>.json?id=<slug>` webu
(funguje bez auth, ale je to interní, nezdokumentované rozhraní webu, ne
veřejné API — křehčí volba na dlouhodobé použití).

### Kam s tím v appce — stav dnes a doporučení

Zjištěno z kódu (`src/`, bez úprav):

- **Bio** se dnes zobrazuje jen inline v `fight-tip-card.tsx` — tlačítko
  "Bio" rozbalí (`Reveal`) dvousloupcový grid s prostým odstavcem textu za
  každého bojovníka. Žádná samostatná komponenta pro bio neexistuje.
- **Tale-of-the-tape** (`fight-matchup.tsx`, `FightMatchup`) mezi jmény
  bojovníků ukazuje rank, rekord, kurzy, váhu/výšku/věk — sdílené mezi
  kartou zápasu, detailem tipujícího a porovnáním. Je to už teď natěsno
  (řádky se renderují jen když aspoň jedna strana má data) — souhlas, že
  sem další čísla nepatří.
  Po ukončení zápasu se tahle tape stejně nahrazuje výsledkem.
- **Žádná samostatná stránka/modal bojovníka neexistuje.** Jediný analogický
  vzor v appce je detail tipujícího na leaderboardu — intercepting route
  `src/app/leaderboard/@modal/(.)u/` + `src/app/leaderboard/u/[userId]/`,
  postavené na obecné modal komponentě `src/components/modal.tsx`
  (focus-trap, zavírání přes Escape/`router.back()`).
- Vizuální jazyk appky: `.glass-surface`/`.glass-pill` pro karty a
  pilulky (bez blur, kvůli výkonu na iOS), skutečný `backdrop-filter`
  blur jen pro plovoucí panely/nav/modaly (`.glass-floating`,
  `.glass-chrome`). Cokoliv nového by mělo tenhle vzor respektovat.

Dvě cesty, kam nová čísla dát:

1. **Rozšířit stávající "Bio" panel v kartě zápasu** o malý řádek se třemi
   glass-pill štítky (finish % / výhry na body % / sig. údery %) a 5
   W/L bublinkami nad nebo pod textem bia. Nejlevnější — žádná nová
   route, žádné nové navigační chování, jen o kousek větší rozbalovací
   panel, který tam uživatel už zná.
2. **Postavit pořádnou detailovou stránku/modal bojovníka** podle vzoru,
   co appka už má u tipujících (intercepting route + `modal.tsx`). Tam by
   šlo bio, tyhle statistiky i (časem) celá historie zápasů z první části
   tohoto dokumentu ukázat pohromadě, místo aby se to nabalovalo do
   jednoho rozbalovacího panelu určeného na rychlý kontext před tipem.

Osobně bych šel na **variantu 2** — bio, statistiky i historie zápasů
tematicky patří k sobě (jsou to všechno "informace o bojovníkovi", ne
"kontext k tomuhle konkrétnímu zápasu") a appka na tenhle vzor (modal přes
intercepting route) už má precedens u tipujících. Navíc pokud se někdy bude
chtít ukázat i celá historie zápasů uživatelům (ne jen pro interní import),
bio panel v kartě zápasu by na to nebyl vhodné místo tak jako tak. Varianta
1 dává smysl jako levný mezikrok, pokud je čas teď omezený.
