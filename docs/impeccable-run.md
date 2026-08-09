# Impeccable run — stav
Branch: design/impeccable
Poslední aktualizace: 2026-08-08

## Kontext pro /impeccable init
- Surface: product (app UI, ne landing page)
- Co to je: tipovací appka na Oktagon galavečery pro uzavřenou partu kamarádů
- Publikum: ~10 lidí, fanoušci MMA, 90 % mobil, špičky před uzávěrkou tipů
- Obrazovky: seznam eventů, fight card s tipováním, uzávěrka, výsledky,
  leaderboard, detail tipů ostatních, profil
- Osobnost: fight-card estetika, vysoký kontrast, dark mode výchozí,
  sportovní a data-driven, hravé — NE korporátní SaaS
- Voice: neformální čeština, krátké, hláškové, ne uměle vtipné
- Anti-reference: generický SaaS dashboard, purple→blue gradient, Inter,
  karty v kartách, ikonka v zakulaceném čtverečku nad nadpisem
- Mantinely: Next.js, Tailwind, Supabase, mobile-first, žádná těžká animační knihovna

## Postup
- [x] 1. init — vytvořen PRODUCT.md z Kontextu (bez interview, AUTO)
- [x] 2. document — vygenerován DESIGN.md + .impeccable/design.json ze skenu existujícího „liquid glass" systému (globals.css, ui komponenty)
- [x] 3. BRÁNA A — kontrola kontextu — uživatel schválil vše default (PRODUCT.md OK, North Star OK, pokračovat bez detectu)
- [x] 4. detect baseline — `node .claude/skills/impeccable/scripts/detect.mjs --json src` funguje přímo (bez npx); baseline uložen do `.impeccable/detect-baseline.json` (52 nálezů: 43 design-system-color, 4 bounce-easing, 1 design-system-radius, 1 gray-on-color, 1 layout-transition, 1 overused-font, 1 design-system-font)
- [x] 5. critique po obrazovkách — odlehčený běh (sub-agent na obrazovku, kód + detect.mjs, bez browseru/dev serveru), zápis do `docs/critique-notes.md`
- [x] 6. audit — statická analýza (a11y/výkon/responzivita/theming/integrita), skóre 15/20 „Good", zápis do `docs/audit-notes.md`
- [x] 7. backlog — 29 položek prioritizovaných P0-P3 s dopadem/rizikem v `docs/design-backlog.md`, 3 otázky pro herní logiku vyčleněny k BRÁNĚ B
- [x] 8. BRÁNA B — schválení backlogu — uživatel schválil P0+P1 (B-1 až B-10) + B-12 do implementace, P2/P3 zbytek do backlogu na později, B-28/B-29 vyhozeno ze scope; podmínka u B-1: nesmí se dotknout superadmin náhledu eventu před veřejným spuštěním
- [x] 9. shape — plán pro nejhorší obrazovku (fight card/uzávěrka/výsledky) v `docs/shape-fight-card.md`, pokrývá B-1, B-4, B-5, B-12
- [x] 10. BRÁNA C — schválení plánu — uživatel schválil beze změn
- [x] 11.–12. implementace po obrazovkách (seznam podle schváleného scope z BRÁNY B):
  1. [x] Fight card / uzávěrka / výsledky — B-1, B-4, B-5, B-12 implementováno (viz Rozhodnutí a BRÁNA D níže)
  2. [x] Seznam eventů — B-2, B-3 implementováno
  3. [x] Leaderboard — B-6 implementováno
  4. [x] Detail tipů ostatních — B-7, B-8 implementováno
  5. [x] Profil — B-9, B-10 implementováno
- [ ] 13. harden + onboard
- [ ] 14. animate + delight
- [ ] 15. extract + polish
- [ ] 16. finální detect + audit
- [ ] 17. BRÁNA E — souhrn a merge

## Rozhodnutí
- `npx impeccable detect` samo (npm-installed wrapper) v sandboxu nejde spustit (blokovaná instalace balíčku z internetu). Zjištěno ale, že skript existuje lokálně v repu skillu a jde spustit přímo: `node .claude/skills/impeccable/scripts/detect.mjs --json <cíl>` funguje bez sítě. Oprava předchozího rozhodnutí: detect kroky (4, 16) se NEPŘESKAKUJÍ, používá se lokální `node` volání místo `npx`; do commit message se i tak píše krátká poznámka o metodě spuštění.
- Init proběhl bez interview — publikum, účel a mantinely už byly zodpovězené v sekci „Kontext", takže PRODUCT.md je odvozen z ní + z prohlídky kódu (routy, package.json), v souladu s pravidlem design-run neptat se na věci zjistitelné z kódu.
- Krok 5 (critique) běžel odlehčeně: jeden sub-agent na obrazovku dělá kód-review + scoped detect.mjs místo plné `critique.md` dual-agent + browser choreografie (žádný dev server/browser session k dispozici, 7 obrazovek by jinak znamenalo 14 izolovaných agentů). Report je v `docs/critique-notes.md`. Lze doběhnout plnou verzi na vyžádání pro konkrétní obrazovku.
- B-1 (countdown/uzávěrka fix): uživatel výslovně potvrdil, že superadmin náhled eventu před veřejným spuštěním (`event.status === "draft" && !isAdmin` gate + `VIEW_MODE_COOKIE`/`isSuperadmin` flow) se touhle opravou nesmí dotknout — fix je scoped čistě na `lock_at`/countdown přechod scheduled→locked přes `router.refresh()`, viz `docs/shape-fight-card.md`. Implementováno jako jediný `setTimeout` v `EventStatusTimeline` (timed přímo na `lock_at`, ne interval), gate na `!locked` — draft/admin gate v `page.tsx` vůbec nedotčen.
- Oprava předchozí opravy: `npx impeccable detect` i `npm install` v tomhle sandboxu NAKONEC fungují (síť je dostupná) — `npx tsc --noEmit`, `npx eslint` a `npx impeccable detect --json` proběhly čistě na všech upravených souborech kroku 11 (0 chyb, 0 nálezů). Od teď se pro implementační kroky používá `npx impeccable detect` přímo, ne jen lokální `node` volání.

## Otevřené otázky
<věci, na které se zeptáš u nejbližší brány>
