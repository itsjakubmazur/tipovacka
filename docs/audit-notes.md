# Audit — impeccable run

Metoda: statická/kódová analýza (grep + čtení klíčových souborů + detect.mjs
baseline), bez běžícího dev serveru / Lighthouse / skutečného screen readeru —
viz Rozhodnutí ve stavovém souboru. Skóre je proto konzervativní odhad, ne
naměřená hodnota.

## Audit Health Score

| # | Dimenze | Skóre | Klíčové zjištění |
|---|---------|-------|-------------------|
| 1 | Accessibility | 2 | `aria-pressed`/`aria-live` chybí na několika interaktivních prvcích (viz critique-notes); focus-visible pokrývá jen 4/12 ui komponent, `back-link.tsx` bez focus stylu |
| 2 | Performance | 3 | Blur (`backdrop-filter`) je disciplinovaně omezen jen na plovoucí vrstvy (15 výskytů v celém `globals.css`, ne na opakující se karty) — přesně podle vlastního "Blur-Where-It's-Earned" pravidla; žádné `will-change` zneužití nalezeno |
| 3 | Responsive Design | 3 | Mobile-first, fixní šířky jsou skoro výhradně `max-w-[…px]` (elastické), žádné icon-only tlačítko bez labelu nenalezeno; drobné pevné `min-w-[34px]/[42px]` boxy pro countdown číslice jsou v pořádku (čitelnost číslic, ne rozvržení stránky) |
| 4 | Theming | 3 | Detect baseline hlásí 43× "Color outside DESIGN.md" — většinou legitimní `rgba()` odstíny glass systému, které do DESIGN.md frontmatter nebyly (a nemůžou být) doslovně přepsány jako pojmenované tokeny; dark mode je funkční a promyšlený (`.dark` třída, ne `prefers-color-scheme`, viz komentář v `globals.css:678-681`) |
| 5 | Implementation Integrity | 4 | Systém je koherentní a záměrný — "liquid glass" vokabulář se používá důsledně napříč komponentami, ne ad-hoc; detektor nenašel systémový drift, jen izolované warningy (bounce-easing) |
| **Total** | | **15/20** | **Good — adresovat slabé dimenze** |

## Implementation Integrity Verdict

**Pass.** Appka má vlastní, konzistentně aplikovaný vizuální systém (glass
vokabulář, jistotka/tipovací mechaniky, sezónní Wrapped), ne generickou
šablonu. Detect baseline (52 nálezů) je většinou `design-system-color`
advisory šum z toho, že glass systém pracuje s desítkami odstínů alpha
`rgba()`, což token frontmatter format nedokáže 1:1 pojmout — to je
očekávané, ne systémový problém.

## Nálezy podle dimenze

### Accessibility
- Viz per-screen critique (`docs/critique-notes.md`) pro konkrétní `aria-pressed`,
  `aria-hidden`, `aria-live` mezery.
- `back-link.tsx` nemá vlastní `focus-visible` styl (jen 4/12 `ui/` komponent
  má explicitní focus ring — zbytek buď dědí, nebo nepotřebuje, protože nejsou
  interaktivní; `back-link` interaktivní je).
- Žádné icon-only tlačítko bez `aria-label` nenalezeno (heuristická kontrola
  `size="icon"` použití).

### Performance
- `backdrop-filter` (skutečný blur) použit jen na 15 míst v celém `globals.css`,
  všechny vázané na plovoucí vrstvy (header, modaly, install prompt) — přesně
  podle vlastního pravidla, ne na opakující se karty/pilulky.
- Žádné `will-change` v kódové bázi (není zneužito, ale ani cíleně použito
  tam, kde by mohlo pomoct u těžších animací jako `podium-rise`/`wrapped-drift`
  — P3, ne nutné).
- Bounce/elastic easing (`cubic-bezier(0.34, 1.4/1.56, …)`) na 4 místech
  (`globals.css:211,232,532,618`) — detektor to označuje jako "slop" (warning),
  ale u appky, kde je to záměrný "arrival with overshoot" pro install prompt a
  potvrzení tipu, jde spíš o stylistickou volbu než výkonový problém. K
  posouzení v BRÁNĚ B, jestli se má změnit.

### Responsive Design
- Mobile-first napříč, `max-w-3xl/5xl/6xl` breakpointy pro shell.
- `viewport-fit: cover` + `env(safe-area-inset-*)` správně řeší notch/home
  indicator na fixním headeru/bottom baru.
- Pevné `min-w-[34px]`/`[42px]` boxy pro countdown číslice jsou úmyslné
  (čitelnost číslic v malém prostoru), ne breakpoint problém.

### Theming
- Dark mode řízen výhradně `.dark` třídou (ne systémovým `prefers-color-scheme`)
  — appka to sama opravila (komentář v kódu popisuje starý bug, kdy glass
  panely braly systémové nastavení místo zvoleného tématu appky).
- 43 "color outside DESIGN.md" nálezů z detectu jsou z drtivé většiny
  legitimní alpha-variace glass systému (`rgba(255,255,255,.1–.95)` apod.),
  ne skutečný drift — DESIGN.md frontmatter schema nemá prostor pro celou
  škálu alpha odstínů jako pojmenované tokeny. Doporučení: neřešit v této
  fázi, jde o mez formátu tokenů, ne o chybu v kódu.

### Implementation Integrity
- Viz verdikt výše. Jediné systémové warningy jsou bounce-easing (4×) a jeden
  `design-system-radius`/`gray-on-color`/`layout-transition`/`overused-font`
  nález — vše izolované, ne opakující se vzorce.
