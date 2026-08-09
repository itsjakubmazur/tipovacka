# Shape plan — Fight card / uzávěrka / výsledky

Nejhorší obrazovka z backlogu (1× P0 + 3× P1/P2 v jednom souboru/komponentě),
implementuje se první. Scope = schválené položky z `docs/design-backlog.md`
pro tuhle obrazovku: **B-1 (P0), B-4 (P1), B-5 (P1), B-12 (P2, jen UI text)**.
Neschválené/mimo scope: nic dalšího se na této obrazovce nemění.

## Job a publikum
Uživatel (jeden z ~10 kamarádů) doťukává tipy na mobilu, typicky v posledních
minutách/hodině před uzávěrkou. Po uzávěrce stejná obrazovka slouží ke
sledování výsledků.

## B-1 — Countdown na nule nezamyká UI klientsky (P0)
- **Příčina**: `locked` se počítá jednou na serveru při renderu stránky
  (`src/app/events/[id]/page.tsx:64-66`). `Countdown` v `event-status-timeline.tsx`
  běží čistě klientsky a při dosažení nuly jen vrátí `null` — nic nedá vědět
  rodičovské stránce, že se má znovu zeptat serveru.
- **Fix**: `Countdown` dostane nepovinný `onExpire` callback, zavolaný přesně
  jednou (guard přes ref, aby se nespustil vícekrát kvůli intervalu). Volající
  (`EventStatusTimeline` → stránka) na něj zareaguje `router.refresh()` (Next.js
  Server Component refetch), takže se `locked` přepočítá ze serveru a karty se
  samy zamknou/zobrazí "po uzávěrce" stav — bez plného reloadu stránky a bez
  ztráty scroll pozice.
- **Bezpečnostní mantinel (od uživatele)**: superadmin musí i nadále vidět
  detail galavečera před veřejným spuštěním tipovačky. Tahle oprava se týká
  výhradně `lock_at`/countdown flow (uzávěrka tipování po startu), ne
  `event.status === "draft"` gate na řádku 167, který řídí viditelnost před
  spuštěním a zůstává nedotčený. `isAdmin`/`isSuperadmin` flow (view-mode
  cookie, draft gate) se v této opravě vůbec nemění.
- **Riziko**: nízké — `router.refresh()` jen znovu spustí existující server
  komponentu se stejnou logikou `locked`, nepřidává novou logiku uzávěrky.

## B-4 — Digit-roll countdown boxy nejsou glass (P1)
- **Fix**: nahradit `border-black/10 bg-black/[0.03]` (`event-status-timeline.tsx:103`)
  za `.glass-field` (běžný stav) / mírně teplejší `.glass-accent-soft`-odvozený
  tón pro `urgent` stav (poslední hodina), konzistentně s existujícím
  `.glass-danger`/`.glass-accent-soft` vokabulářem z `globals.css`. Barva textu
  číslic (žlutá/červená) se nemění, jen podklad boxu.

## B-5 — Duplicitní "skoč na netipovaný zápas" UI (P1)
- **Fix**: `JumpToUntipped` (floating pill, `page.tsx:589`) se na mobilu potlačí,
  když je `TipActionBar`'s "Dotipovat (N)" tlačítko viditelné ve viewportu
  (IntersectionObserver na action baru), aby na malé obrazovce svítilo jen
  jedno CTA se stejnou funkcí. Na desktopu, kde je action bar často mimo
  hlavní sloupec, floating pill zůstává.

## B-12 — Osiřelá jistotka bez vysvětlení (P2, jen UI text)
- **Fix**: v bloku zrušených zápasů (`cancelled fights block`) přidat řádek
  "Tvoje jistotka byla na tenhle zápas, body se nezapočítaly" když zrušený
  zápas odpovídá uživatelovu `boldPick`. **Nesahá se na výpočet bodů** — jen
  se doplní text tam, kde už existuje UI pro zrušené zápasy.

## Co zůstává nedotčené
- Výpočet bodů, jistotka logika, realtime refresh interval po uzávěrce,
  `event.status === "draft"` admin/superadmin gate, `VIEW_MODE_COOKIE` flow.
- Zbytek obrazovky (fight matchup karty, FOTN picker, komentáře, payout pool).

## Stav a rozsahy
- Countdown expiruje přesně jednou za návštěvu stránky (guard), i kdyby
  `setInterval` tikl vícekrát po nule.
- Funguje stejně pro `main_card`/`prelims`/`free_prelims` segmenty a pro
  `completed`/`live`/`scheduled` stavy eventu (fix se týká jen přechodu
  scheduled → locked).
