# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Uzavřená parta ~10 kamarádů, fanoušci MMA, kteří společně tipují výsledky
zápasů na Oktagon galavečerech. 90 % používání je na mobilu, s náporem
aktivity těsně před uzávěrkou tipů na daný event.

## Product Purpose
Appka pro tipování výsledků zápasů na Oktagon MMA galavečerech v rámci
uzavřené skupiny kamarádů. Uživatelé tipují jednotlivé souboje na fight
cardu před uzávěrkou, po eventu se tipy vyhodnotí a promítnou do
leaderboardu skupiny. Úspěch = parta se baví sledováním eventu společně
přes appku a soutěží o body.

## Positioning
Neveřejný, kamarádský tipovací nástroj specificky pro Oktagon (ne obecný
sportovní tipovací produkt) — bez peněz, bez veřejné soutěže, jen skóre
a žebříček uvnitř uzavřené skupiny.

## Operating Context
- Eventy = Oktagon galavečery, každý má fight card (seznam zápasů).
- Před uzávěrkou uživatelé tipují výsledky jednotlivých zápasů.
- Po uzávěrce se tipy uzamknou; po eventu se zadají výsledky a spočítají body.
- Skupiny (`groups`) sdružují uživatele, mají vlastní leaderboard a historii.
- Sdílení výsledků/žebříčku navenek (share card, podium, wrapped roční shrnutí).
- Admin sekce pro správu eventů, scraper log a chybové logy (interní, ne pro
  běžné uživatele).
- Push notifikace (blížící se uzávěrka apod.).

## Capabilities and Constraints
- Next.js (App Router), Tailwind, Supabase (auth + data), mobile-first.
- Žádná těžká animační knihovna.
- Realtime/uzávěrky a bodovací logika jsou citlivé na chyby — nezasahovat
  bez jistoty dopadu (viz bezpečnostní pravidla design-run workflow).
- PWA prvky přítomny (`components/install`, `components/push`).

## Brand Commitments
- Fight-card estetika, vysoký kontrast, dark mode výchozí, sportovní a
  data-driven, hravé — výslovně NE korporátní SaaS vzhled.
- Voice: neformální čeština, krátké, hláškové texty, ne uměle vtipné.
- Anti-reference: generický SaaS dashboard, purple→blue gradient, Inter,
  karty v kartách, ikonka v zakulaceném čtverečku nad nadpisem.

## Evidence on Hand
Zdroj pravdy je existující kódová báze (`src/app`, `src/components`).
Žádné externí testimonials/case studies k dispozici — nevymýšlet.

## Product Principles
1. Mobil především — appka se používá hlavně v ruce, ve špičce před uzávěrkou.
2. Rychlost tipování nad vším — co nejméně tření mezi otevřením a odesláním tipu.
3. Parta, ne veřejnost — tón a UI jsou kamarádské a neformální, ne korporátní.
4. Data mluví — výsledky, skóre a žebříček jsou vždy čitelné na první pohled.
5. Nesahat na herní logiku (body, uzávěrky, realtime) bez jistoty dopadu.

## Accessibility & Inclusion
Žádný specifický požadavek nebyl stanoven nad rámec běžné dobré praxe
(kontrast, čitelnost na mobilu).
