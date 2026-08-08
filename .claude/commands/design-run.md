---
description: Řízený průchod Impeccable workflow pro tipovačku — pokračuje tam, kde skončil
---
Jsi průvodce design workflow pro tuhle appku. Řídíš se stavovým souborem
`docs/impeccable-run.md`.
## Jak pracuješ
1. Přečti `docs/impeccable-run.md`. Pokud neexistuje, vytvoř ho podle šablony
   na konci tohohle souboru a zacommituj.
2. Najdi první nesplněný krok a pokračuj od něj.
3. Kroky označené **AUTO** provedeš bez ptaní.
4. U kroků označených **BRÁNA** se zastavíš, položíš otázky a čekáš na odpověď.
5. Po každém dokončeném kroku zaškrtni řádek ve stavovém souboru, dopiš
   jednou větou co jsi udělal, a zacommituj (kód i stavový soubor v jednom commitu).
6. V jednom spuštění projdi tolik AUTO kroků, kolik jich je před nejbližší BRÁNOU.
   U brány skonči odpověď a čekej.
## Jak se ptáš
Tohle je závazné, protože uživatel nechce řešit detaily:
- Otázky dávej **naráz, číslované, maximálně 5 v jedné dávce**.
- U **každé** otázky napiš svoje doporučení a zdůvodnění jednou větou.
- Formuluj je tak, aby šly zodpovědět jedním slovem nebo číslem.
- Vždy nabídni možnost odpovědět „vše default" = beru všechna tvoje doporučení.
- Neptej se na věci, které si můžeš zjistit z kódu, z `DESIGN.md` nebo
  z `docs/design-backlog.md`. Rozhodni sám a rozhodnutí zapiš do stavového souboru
  do sekce „Rozhodnutí".
- Neptej se na potvrzení něčeho, co už jednou schválil.
## Bezpečnostní pravidla
- Pracuj na branchi `design/impeccable`. Když neexistuje, založ ji.
- Jeden `/impeccable` příkaz = jeden commit. Nikdy neslučuj víc příkazů do commitu —
  uživatel musí umět vrátit jeden krok.
- V diagnostické fázi neměň ani jeden soubor s kódem.
- Po každém implementačním kroku spusť `npx impeccable detect` na dotčené soubory
  a výsledek napiš do commit message.
- Když si nejsi jistý dopadem změny na herní logiku (bodování, uzávěrky, realtime),
  nesahej na ni a napiš to jako otázku k nejbližší bráně.
## Fáze a brány
| # | Krok | Režim |
|---|------|-------|
| 1 | `/impeccable init` — vyplň z odpovědí v sekci „Kontext" stavového souboru | AUTO |
| 2 | `/impeccable document` — zdokumentuj, co je fakticky v kódu | AUTO |
| 3 | Ukaž `PRODUCT.md` + `DESIGN.md`, u každého tokenu napiš odkud je | **BRÁNA A** |
| 4 | `npx impeccable detect` → baseline do `.impeccable/detect-baseline.json` | AUTO |
| 5 | `/impeccable critique` po obrazovkách, jen reporty | AUTO |
| 6 | `/impeccable audit` — a11y, responsivita, výkon, jen report | AUTO |
| 7 | Slož `docs/design-backlog.md` — prioritizovaně, s dopadem a rizikem | AUTO |
| 8 | Předlož backlog ke schválení a navrhni, co vyhodit | **BRÁNA B** |
| 9 | `/impeccable shape` na nejhorší obrazovku → plán do `docs/` | AUTO |
| 10 | Předlož plán | **BRÁNA C** |
| 11 | Implementace obrazovky: layout → typeset → colorize → adapt → clarify | AUTO |
| 12 | Shrň diff obrazovky, ukaž detect výsledek, zeptej se na další obrazovku | **BRÁNA D** (opakuje se) |
| 13 | `/impeccable harden`, `/impeccable onboard` — chování, edge cases, prázdné stavy | AUTO |
| 14 | `/impeccable animate`, `/impeccable delight` — střídmě | AUTO |
| 15 | `/impeccable extract` + `/impeccable polish` | AUTO |
| 16 | Finální `detect` proti baseline + `/impeccable audit`, souhrn rozdílů | AUTO |
| 17 | Předlož souhrn celého běhu a návrh na merge | **BRÁNA E** |
Krok 11 a 12 se opakují pro každou obrazovku ze schváleného backlogu.
## Šablona stavového souboru
```markdown
# Impeccable run — stav
Branch: design/impeccable
Poslední aktualizace: <datum>
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
- [ ] 1. init
- [ ] 2. document
- [ ] 3. BRÁNA A — kontrola kontextu
- [ ] 4. detect baseline
- [ ] 5. critique po obrazovkách
- [ ] 6. audit
- [ ] 7. backlog
- [ ] 8. BRÁNA B — schválení backlogu
- [ ] 9. shape
- [ ] 10. BRÁNA C — schválení plánu
- [ ] 11.–12. implementace po obrazovkách (doplň seznam po BRÁNĚ B)
- [ ] 13. harden + onboard
- [ ] 14. animate + delight
- [ ] 15. extract + polish
- [ ] 16. finální detect + audit
- [ ] 17. BRÁNA E — souhrn a merge
## Rozhodnutí
<sem zapisuj, co jsi rozhodl sám a proč — jeden řádek na rozhodnutí>
## Otevřené otázky
<věci, na které se zeptáš u nejbližší brány>
```
