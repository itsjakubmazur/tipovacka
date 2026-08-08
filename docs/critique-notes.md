# Critique notes — impeccable run

⚠️ Metoda: odlehčený běh (ne plný `critique.md` dual-agent + browser choreografie).
Pro každou obrazovku běžel jeden sub-agent, který četl zdrojový kód, `DESIGN.md`
a spustil `node .claude/skills/impeccable/scripts/detect.mjs --json <cíle>`
scoped na dotčené soubory. Bez live browseru / dev serveru (viz Rozhodnutí ve
stavovém souboru). Detektor napříč všemi obrazovkami nic nenašel — nálezy
z baseline detectu (52, hlavně `design-system-color`) jsou plošné/CSS a
neváží se k jedné konkrétní obrazovce, viz `.impeccable/detect-baseline.json`.

---

## Seznam eventů — critique

**Detector findings**: 0.

**Strengths**:
- Chytře scoped prefetch — jen dvě pravděpodobně otevírané karty dostanou plný prefetch dat.
- Teaser karta správně přebírá glass-accent jazyk a dokumentuje proč potřebuje light-mode specifickou zlatou.

**Priority issues**:
- **P1** Uzamčeno vs. Vyhodnoceno mají stejný šedý `variant="secondary"` badge (`page.tsx:222`) — nelze na první pohled odlišit "právě uzamčeno" od "dávno hotovo". Fix: vlastní vizuál pro `locked`.
- **P1** Hero slot (`lg:[&>*:first-child]:col-span-3`, `page.tsx:131`) je vázán na pořadí v poli, ne na `primaryEventId`/`liveEvent` — draft teaser karta se může natáhnout do hero slotu určeného pro plakát.
- **P2** Prázdný stav (`page.tsx:124`, "Žádné galavečery zatím nejsou.") je jediný prvek na obrazovce, který není glass surface.
- **P3** "Tipnuto X z Y zápasů" je jen text, glass progress bar by četl rychleji.

**Persona red flag**: Casey 90s před uzávěrkou nepozná uzamčenou vs. dohranou galu podle stejného šedého badge.

---

## Fight card / uzávěrka / výsledky — critique

**Detector findings**: 0 (statický scan není tvarovaný na state-transition problémy, které jsou tu hlavní).

**Strengths**:
- Sbalený `EventStatusTimeline` neopakuje stejný fakt třikrát (countdown je countdown, ne countdown + popisek + status slovo).
- `FightTipCard` gating (`tipComplete`/`tipInProgress`) brání tomu, aby napůl vyplněný tip vypadal jako hotový.
- Per-third feedback (vítěz/metoda/kolo zvlášť) dává skutečnou diagnostickou hodnotu ve výsledkovém stavu.

**Priority issues**:
- **P0** Countdown na nule nezamkne UI klientsky — `Countdown` jen vrátí `null`, `RealtimeRefresh` nereaguje na dosažení nuly. Uživatel může ťukat po uzávěrce a dostane matoucí "Uložení se nepodařilo." Fix: lokálně zamknout kartu při dosažení nuly / vynutit reload.
- **P1** Digit-roll countdown boxy nejsou glass (`event-status-timeline.tsx:103`, flat `border-black/10 bg-black/[0.03]`) — porušuje pravidlo "vše přes glass vokabulář", zrovna v nejviditelnějším momentu (poslední hodina, červené číslice).
- **P1** Dvě redundantní "skoč na netipovaný zápas" UI zároveň na mobilu (`TipActionBar` tlačítko + `JumpToUntipped` floating pill).
- **P2** Bold pick (jistotka) tiše osiří, pokud je zápas zrušen po uzávěrce — žádné vysvětlení ztráty bodů.
- **P2** `Pill` tlačítka nemají `aria-pressed` — screen reader nedostane stavovou zpětnou vazbu při výběru vítěze/metody/kola.

**Persona red flag**: Casey s 90s na hodinách vidí countdown zmizet na nule, karta pořád vypadá tipovatelně, ťukne — a nedozví se, že se tip neuložil.

---

## Leaderboard — critique

**Detector findings**: 0.

**Strengths**:
- Segmented-control + sticky rail layout je mobile-first a povyšuje se na dva sloupce na desktopu bez přeskládání DOM; podium/journey/replay správně remountují podle `selectedEvent.id`.
- `PodiumCard` má solidní progressive-enhancement sdílecí flow (native file share → native text share → clipboard fallback), vše v try/catch.

**Priority issues**:
- **P1** `RankMedal` ikona není `aria-hidden`, i když má vlastní `aria-label` na wrapperu — screen reader může hlásit rank dvakrát.
- **P2** Scoring legenda (tie-break, jistotka pravidla) je defaultně sbalená v `<Disclosure>` — pro partu bez předchozího kontextu snadno nikdy neobjevená.
- **P2** Podium se renderuje jen při `eventRows.length >= 3` — u malých eventů (1-2 hráči) tiše mizí oslavný moment bez náhradní zprávy.
- **P3** Konfety při 1. místě se spouští při každém načtení stránky, ne jen napoprvé.

**Persona red flag**: Sam (screen reader) může slyšet rank dvakrát kvůli chybějícímu `aria-hidden` na medaili.

---

## Detail tipů ostatních — critique

**Detector findings**: 0.

**Strengths**:
- Season souhrn a historie eventů správně používají glass vokabulář (`glass-surface`, `glass-accent-soft` badge, tabular-nums).
- `CompareFightCard` znovupoužívá `FightMatchup` místo bespoke layoutu pro porovnání.

**Priority issues**:
- **P1** `BackLink` uvnitř intercepted-route modalu dělá tvrdou navigaci na `/leaderboard` místo zavření overlaye přes `router.back()` — rozbíjí iluzi "je to jen sheet nad stránkou".
- **P1** Hráč bez eventů/tipů (`stats.events` prázdné) vidí jen jméno a sezónu, žádný empty-state text — vypadá jako rozbitá stránka.
- **P2** Přímý odkaz `/leaderboard/u/[userId]` (mimo modal) nemá `loading.tsx` — pomalý dotaz ukáže prázdno bez indikace.
- **P2** `compare-fight-card.tsx:68` hardcoduje `text-blue-500` místo tokenu z Glass Blue palety.
- **P3** Zpráva "Tipy se zobrazí až po uzávěrce" je holý text bez glass containeru, na rozdíl od zbytku stránky.

**Persona red flag**: Riley otevře profil kamaráda bez tipů a vidí prázdnou stránku bez vysvětlení, že prostě ještě netipoval.

---

## Profil — critique

**Detector findings**: 0.

**Strengths**:
- Všechny mutující formuláře sdílí stejný saving → error/saved → disabled state machine napříč 9 widgety.
- `notification-preferences.tsx` staví custom toggly jako reálné `<button role="switch" aria-checked>` — dobrý a11y základ.

**Priority issues**:
- **P1** Nekonzistentní chrome: většina widgetů má `<Section title=…>`, ale `nickname-form.tsx` a `change-password-form.tsx` ne — na stránce s 9 kartami se ztrácí ve skenování.
- **P1** `bank-account-form.tsx` validuje formát jen při submitu, ne za psaní/blur — riziko překlepu u čísla účtu, kam jdou peníze mezi kamarády.
- **P2** Placeholder čísla účtu vypadá jako reálná hodnota (chybí "např." přímo v placeholderu).
- **P2** `nickname-form.tsx` neořezává whitespace-only přezdívku před uložením.
- **P3** `change-password-form.tsx` neresetuje "Heslo změněno." při editaci jen pole potvrzení hesla.

**Persona red flag**: Sam u notifikačních přepínačů nedostane `aria-live` potvrzení uložení — jen vizuální flash zprávy na 1.8s.
