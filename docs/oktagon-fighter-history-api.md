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
| `GET /v1/fighters/{id}/stats` | 200 / 404 | **Použitelné, ale ne vždy dostupné.** `highlights` objekt s `finishRate`, `finishEndTypePercentageWins`, `hitTypePercentage`, `lastFightsResults` a další (viz dodatek níže). 404 `"Stats not found using both legacy and esports ids."` u bojovníků, pro které tahle data OKTAGON nemá napárovaná. |
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

### Potvrzená REST cesta: `GET /v1/fighters/{id}/stats`

Doplněno po druhém kole průzkumu (2026-09-11, tentýž den) — cesta se
nenašla hádáním ani ze zachycených XHR (Next.js na `oktagonmma.com` renderuje
fighter profil server-side, takže prohlížeč po tvrdém načtení stránky žádný
XHR na `api.oktagonmma.com` neudělá; `_next/data` JSON se navíc natáhne jen
při SPA navigaci, ne při přímém vstupu na URL). Skutečnou cestu jsem našel
tak, že jsem v Chromu otevřel profil bojovníka, v `document.scripts` našel
stránkový JS chunk (`pages/fighters/[id]-*.js`), stáhl ho a v minifikovaném
kódu dohledal react-query hook, který volá:

```js
d = async (id, opts) => (await oktApiAxiosClient.get(`/fighters/${id}/stats`, opts)).data
```

— tedy **`GET /v1/fighters/{id}/stats`** (stejný `oktApiAxiosClient`, jako
zbytek `/v1/...`). Ověřeno curlem:

```
GET /v1/fighters/385/stats  → 200, vrací přesně strukturu highlights výše
GET /v1/fighters/678/stats  → 404 {"message":"Stats not found using both legacy and esports ids."}
GET /v1/fighters/551/stats  → 404 (stejná zpráva)
```

**Tahle data nejsou u všech bojovníků.** Chybová hláška prozrazuje, že se
statistiky vedou v odděleném systému (`esports.cz` — viz níže), spárovaném
přes `legacyId`/`metadata.esportsId` z `/v1/fighters/{id}`. Zkusil jsem
hypotézu "chybí `legacyId` → chybí stats", ale nesedí: Kerim Engizek
(`id=551`) `legacyId` **má** (64733), přesto `/stats` vrací 404 — takže
dostupnost prakticky nejde předem odhadnout z ničeho, co máme, a je nutné
počítat s tím, že endpoint pro konkrétního bojovníka prostě někdy vrátí 404
(u nás v UI = žádné stat-štítky, žádná chyba). Zkoumaný vzorek byl malý
(3 bojovníci), takže není jasné, jestli je to vzácná výjimka nebo běžná věc
u míň sledovaných jmen — dřív než se na to bude spoléhat, stálo by za to
zkusit endpoint na víc bojovníků (mimo scope tohoto zápisu).

Vedlejší nález ze stejného JS chunku: **živá "kolo po kole" data k
jednotlivému zápasu** (odznaky "OKTAGON 91 fight statistics" apod. —
`fight-statistics.tsx`, `fighters-comparison.tsx`) jdou z úplně **jiného,
externího systému**: `oktApiAxiosClient` se pro tohle nepoužívá, místo toho
`axios.create({baseURL: "https://oktagon.sh12w3.esports.cz/api/export/"})`,
volané jako `GET /matches/external/{legacyId}` nebo `GET /matches/{esportsId}`
(`legacyId`/`esportsId` = pole `metadata.legacyId`/`metadata.esportsId` na
zápasu z `/v1/fights`). To je zjevně cizí doména (samostatná esportová
timing/stat firma, ne OKTAGON), takže bych na ni nesázel jako na oficiální
zdroj — zmiňuju jen pro úplnost, `finishRate`/`hitTypePercentage`/
`lastFightsResults` z `/v1/fighters/{id}/stats` jsou pro naše potřeby
dostačující a jsou na `api.oktagonmma.com`, ne na cizí doméně.

Vzorek reálné odpovědi: `fighter_stats_patrik-kincl.json`.

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

## Dodatek 2: pozápasové statistiky konkrétního zápasu (hity, sig. hity, takedowny...)

Doplněno na žádost prozkoumat, jestli existují **statistiky jednoho
konkrétního odehraného zápasu** (ne kariérní průměry z Dodatku 1), které by
šlo přidat vedle toho, co už o zápasu ukazujeme (výsledek, čas, kolo,
způsob) — tzn. hity, signifikantní hity, takedowny, pokusy o submisi apod.

### Ano, existují — ale je to úplně jiný, cizí systém

V tom samém JS chunku (`pages/fighters/[id]-*.js`), kde je definovaný hook
na `/v1/fighters/{id}/stats` (Dodatek 1), je hned vedle druhý hook pro
**data konkrétního zápasu**:

```js
let r = axios.create({
  baseURL: "https://oktagon.sh12w3.esports.cz/api/export/",
  validateStatus: () => true,
});
// zkusí legacyId, když není/nevyjde, zkusí esportsId:
await r.get(`/matches/external/${fight.legacyId}`);
await r.get(`/matches/${fight.metadata.esportsId}`);
```

`oktagon.sh12w3.esports.cz` je cizí doména — externí dodavatel živého
"fight trackingu" (soudě podle názvu český esportový/timing systém), OKTAGON
k ní nemá vlastní branding ani `api.oktagonmma.com` prefix. **Neexistuje
oficiální dokumentace, žádná autentizace nebyla potřeba** (veřejně čitelné
přes `GET`), ale je to nezávislý systém mimo OKTAGON API — je potřeba s tím
počítat jako s méně stabilním zdrojem (může se kdykoli změnit/přestat
fungovat, aniž by to OKTAGON řešil jako svůj breaking change).

Napojení na náš `fight.id`: přes `fight.metadata.esportsId` (pole, co už
máme z `/v1/fights` / fightcard — viz hlavní část dokumentu). `legacyId` na
úrovni zápasu jsem nikde v datech nenašel (jen bojovníci mají vlastní
`legacyId`), takže v praxi se použije vždy jen `esportsId`.

### `GET https://oktagon.sh12w3.esports.cz/api/export/matches/{esportsId}`

Ověřeno na dvou reálných zápasech (200 u obou):

- `esportsId=1093` — Kincl vs. Khajevand (OKTAGON 91), SUB ve 2. kole →
  `esportscz_match-stats_submission-example_1093.json`
- `esportsId=981` — OKTAGON 81, DEC na 3 kola →
  `esportscz_match-stats_decision-example_981.json`

Klíčová pole v odpovědi:

- `endType`, `endTime`, `rounds`, `roundsCount` — **stejná informace**, co
  už máme z `/v1/fights` (`resultType`, `time`, `numRounds`), jen jinak
  pojmenovaná. Redundantní, ne potřeba k ničemu novému.
- `fighter1`/`fighter2`/`winner` — vlastní (jiná, esports.cz interní) `id`
  bojovníků; `fighter{1,2}.externalId` odpovídá **bojovníkovu**
  `legacyId` z `/v1/fighters/{id}` (u Kincla `externalId: 56682` ==
  `legacyId: 56682`) — tudy jde párovat, kdyby bylo potřeba.
- **`hits`** — pole **jednotlivých úderů/zásahů** za celý zápas (72 u
  zápasu 1093, 163 u zápasu 981!), každý se `attacker`, `defender`,
  `matchRound`, `matchTime` (sekundy od začátku kola), `type`
  (`"significant"` / `"insignificant"`) a `target` (`"head"` / `"body"` /
  `"legs"`). V obou vzorcích má `result` vždy jen hodnotu `"landed"` —
  nenarazil jsem na žádnou jinou hodnotu, i když název pole naznačuje, že
  by tam mohlo být i něco jako "blocked"/"missed" (nepotvrzeno, malý
  vzorek).
- **`takedowns`** — pole pokusů o takedown, stejný tvar (`attacker`,
  `defender`, `matchRound`, `matchTime`), `result: "completed"` nebo
  `null` (= neúspěšný pokus).
- **`submissionAttempts`** — stejně, `result: "completed"` (u zápasu 1093
  jde o ten samý moment, co zápas ukončil submisí).
- `possessions` — v obou vzorcích prázdné pole; podle názvu asi
  grappling/ground-control časy, ale bez dat to nejde ověřit.

Z `hits`/`takedowns`/`submissionAttempts` by šlo dopočítat přesně to, co
web ukazuje ve widgetu "ALL HITS / SIGNIFICANT HITS / TAKEDOWNS / SUBMISSION
ATTEMPTS" (`fight-statistics.tsx`) — prostý součet podle `attacker.id` a
`type`/`target`, případně rozpad po kolech (`matchTime`/`matchRound` už
tam je).

### Jak daleko do minulosti tohle sahá

**Ne moc daleko — o dost méně, než historie výsledků.** `esportsId`
(klíč k tomuhle systému) v `metadata` u zápasu chybí u starých eventů
úplně (`oktagon-1` z roku 2016 má `metadata: {}` u všech zápasů) a chybí
ještě i u zápasu z **OKTAGON 43 (2023-05-20)**. První potvrzený výskyt
`esportsId` v datech, na která jsem narazil, je **OKTAGON 52
(2024-01-27)**. Rozmezí OKTAGON 43–52 jsem neprocházel zápas po zápasu
(bylo by to dost requestů), takže přesné datum zavedení nemám, ale řádově
**early/mid 2024** je bezpečný odhad dolní hranice použitelnosti. Zápasy
před tím tahle data mít nebudou.

I v rozmezí, kde `esportsId` existuje, není jistota, že `/matches/{id}`
vrátí 200 (viz nejistá dostupnost `/v1/fighters/{id}/stats` v Dodatku 1) —
je to cizí systém, testoval jsem jen 2 zápasy a oba vyšly, ale na větším
vzorku bych se 100% spoléháním nepočítal.

### Doporučení

Tohle bych **do appky nedával jako spolehlivou trvalou funkci**, spíš jako
"bonus, pokud je k dispozici": zkusit `GET /matches/{esportsId}` při
importu výsledku zápasu, a pokud vrátí 200, uložit si agregáty (hity/sig.
hity/takedowny/pokusy o submisi za zápas, případně po kolech) k tomu
zápasu; když 404/timeout, prostě to okno neukázat. Vzhledem k tomu, že je
to cizí doména bez SLA k OKTAGONu, bych to nestavěl jako blokující krok
importu (`cron.py`) — spíš jako samostatný, volitelný doplňkový krok, který
smí selhat. Vizuálně: dobrý kandidát právě do fighter modalu z Dodatku 1
(řádky "ALL HITS"/"SIGNIFICANT HITS"/"TAKEDOWNS"/"SUBMISSION ATTEMPTS" pro
oba bojovníky vedle sebe, přesně jako to má sám OKTAGON ve svém
`fight-statistics.tsx`), ne do samotné karty zápasu — je to detail, co
zajímá jen toho, kdo si zápas prohlíží zpětně, ne při rychlém tipování.
