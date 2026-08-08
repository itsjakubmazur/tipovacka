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
- `npx impeccable detect` v tomhle sandboxu nejde spustit (blokovaný network install balíčku) — všechny kroky s detectem (4, 16, commit-message výstupy) se přeskakují; místo detect výstupu se do commit message píše poznámka "detect: skipped (sandbox blocks package install)".
- Init proběhl bez interview — publikum, účel a mantinely už byly zodpovězené v sekci „Kontext", takže PRODUCT.md je odvozen z ní + z prohlídky kódu (routy, package.json), v souladu s pravidlem design-run neptat se na věci zjistitelné z kódu.

## Otevřené otázky
- Viz BRÁNA A níže — schválení PRODUCT.md a DESIGN.md.
