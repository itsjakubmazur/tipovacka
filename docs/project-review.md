# Project review — OKTAGON GARÁŽ Tipovačka

Datum: 2026-08-18
Vůči: `main` @ `6de090e` (po design runu + cache/revalidate hotfixes)

**Implementace (tento branch):** vlny 1–4 jsou v kódu. Migrace
`20260743000000_integrity_and_privacy.sql` se na živou DB dostane až merge
na `main` (workflow `db-migrate`). Před prvním fight night po merge ověřit:

- anon GET `profiles?select=*` nesmí vrátit `bank_account` (sloupec je pryč)
- PATCH `predictions.points` musí selhat
- uložení tipu (upsert) musí pořád projít
- `admin_set_user_admin` znovu povyšuje

Tohle **není** opakování `docs/critique-notes.md` / `docs/audit-notes.md`.
Designová vrstva už má za sebou poctivý běh (P0+P1 z `docs/design-backlog.md`
jsou hotové, čeká se na BRÁNU E). Tady jde o **produkt, bezpečnost, data a
architekturu** — a o to, co by se mělo dělat dál, místo dalšího leštění skla.

---

## Verdikt

Appka je na uzavřenou partu ~10 lidí **nezvykle dobře postavená**. Má vlastní
vizuální jazyk (fight-night glass), herní logika žije v Postgresu, cache je
vědomě rozdělená na sdílenou vs. cookie-bound, PWA/iOS omezení jsou
zdokumentovaná v kódu, scraper má pytest. Tohle není šablona z `create-next-app`.

Hlavní riziko **není** „vypadá to genericky“. Hlavní riziko je, že produkt
narostl (skupiny, kecárna + GIF, live poll, wrapped, startovné/QR, admin,
push) rychleji než **hranice důvěry**. Zápisy jdou z browseru přes anon klíč
a RLS — a RLS na několika místech bere klienta jako kamaráda.

Druhý problém je **produktová roztěkanost**. Nav má čtyři položky pro deset
lidí, kteří už jsou jedna skupina. Skupiny, live poll a GIF picker jsou
feature, ne nutnost. Každá z nich stojí hydrataci a údržbu na fight night,
kdy PRODUCT.md říká, že záleží jen na rychlosti tipu.

---

## Co je výjimečně dobré (držet)

- **Canonical scoring v SQL** (`calculate_points`, views, cancelled/NC
  vyloučení, jistotka ×2, FOTN +2, perfect card +5). UI jen zrcadlí.
- **Cache architektura**: `createCachedClient()` (service-role) uvnitř
  `unstable_cache`, webhook `revalidateTag(..., { expire: 0 })` + 300s
  pojistka. Event detail = cached shell + `Suspense` personalizace.
- **PWA realismus**: SW neinterceptuje navigace; `RealtimeRefresh` skládá
  Realtime + `visibilitychange` + poll, protože iOS socket v pozadí zabíjí.
- **Ops scrape chain** je ošklivá (cron-job.org → Vercel → GitHub Actions →
  Python), ale **vědomě** — heartbeat, Healthchecks, rehearsal, pytest.
- **Hlas**: neformální čeština, krátké copy, `/pravidla` čitelné.
- **CI**: lint + tsc + build + Playwright smoke + scraper pytest. Málo testů
  na appku, ale pipeline není divadlo.

---

## Kritická zjištění

### P0 — `profiles` SELECT je veřejný, včetně čísla účtu

```243:244:supabase/migrations/20260618000000_init.sql
create policy profiles_select_all on public.profiles
  for select using (true);
```

`bank_account` přibyl později (`20260714000000_event_payouts.sql`) na stejný
řádek. Anon klíč je v klientovi. Kdokoli, kdo zná `NEXT_PUBLIC_SUPABASE_URL`,
si přes REST vytáhne **všechna čísla účtů, nicknames, `is_admin` /
`is_superadmin`**. To je osobní finanční údaj, ne nickname na žebříček.

Stejná politika dává smysl pro `nickname`. Nedává smysl pro zbytek sloupce.

**Fix:** column-level revoke / view `public_profiles (id, nickname)` pro
SELECT všem; `bank_account` jen vlastník + (po uzávěrce, když jsou payouts
zapnuté) ostatní členové, nebo ještě lépe jen RPC „účet vítěze tohoto
eventu“. Anon SELECT na `profiles` zrušit.

### P0 — uživatel může zapsat `predictions.points` (a FOTN body)

```314:325:supabase/migrations/20260618000000_init.sql
create policy predictions_update_own on public.predictions
  for update using (auth.uid() = user_id)
  with check ( ... unlocked ... );
```

UI posílá jen winner/method/round (`FightTipCard.persist`). RLS ale
**nesvazá sloupce**. Stejný vzor u `bonus_predictions`. Leaderboard views
sčítají `pr.points`. Fake body sedí, dokud někdo nespustí `recalculate_*`.
Když se FOTN nikdy nezadá, falešné bonus body **zůstanou**.

**Fix:** `REVOKE UPDATE (points)` na obě tabulky pro `authenticated`, nebo
BEFORE trigger, který `NEW.points` vždy přepíše z `calculate_points` /
FOTN pravidla (unlocked → NULL). Recalc funkce zúžit na admin/service_role.

### P1 — `protect_is_admin` rozbil povyšování adminů

`admin_set_user_admin` nastaví `app.admin_override` a čeká, že trigger
změnu pustí (`20260618030000_admin_management.sql`). Superadmin migrace
funkci přepsala a **override vyhodila**:

```12:24:supabase/migrations/20260708000000_superadmin.sql
create or replace function public.protect_is_admin()
...
    if new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
```

`PromoteUserButton` tedy s největší pravděpodobností **tiše nic neudělá**.

**Fix:** vrátit override, nebo přepsat RPC tak, aby UPDATE běžel jako
vlastník tabulky mimo `authenticated`. Ověřit jedním SQL testem.

### P1 — `recalculate_bonus_points` smí spustit kdokoli přihlášený

```44:44:supabase/migrations/20260622000000_fotn_bonus.sql
grant execute on function public.recalculate_bonus_points(uuid) to authenticated;
```

Bez kontroly admina. Při `actual_fotn_fight_id IS NULL` vynuluje FOTN
skóre. `recalculate_event_points` / `recalculate_fight_points` nemají v
migracích GRANT — default u funkcí je často `PUBLIC` execute.

**Fix:** `REVOKE ALL ... FROM PUBLIC, authenticated`; GRANT jen service_role
(případně definer RPC s `is_admin` check, jako `swap_fight_order`).

### P1 — auth gate je dírami v stránkách, ne v `proxy.ts`

`src/proxy.ts` jen obnovuje session. `/events` **nepřesměruje**
nepřihlášeného — seznam galavečerů, plakáty, místa a časy jsou veřejné.
`/events/[id]` sice `redirect("/login")`, ale až **po** `getEventShared(id)`
(service-role, celá karta + komentáře do cache).

E2E to nechytí: smoke testuje `/leaderboard`, `/profile`, `/wrapped`, ne
`/events`.

**Fix:** v `proxy.ts` allowlist (`/`, `/login`, `/auth/*`, `/pravidla`,
`/share/*`, PWA assety). Event detail nenačítat shared cache před auth.
Do smoke přidat `/events` a `/groups`.

### P1 — leaderboard views obcházejí RLS tipů

`event_leaderboard` / `season_leaderboard` / `group_season_leaderboard`
nemají `security_invoker`. Běží jako owner → vidí `predictions` před
`lock_at`, včetně `earliest_prediction_at` (kdo už tipnul a kdy).
Základní tabulky to schovávají správně; view díru otevírá znovu.

**Fix:** `WITH (security_invoker = true)` + SELECT policy až po lock, nebo
z view vyhodit pre-lock sloupce a `earliest_prediction_at` počítat až po
uzávěrce.

### P1 — zvací kód je krátké sdílené tajemství + anon oracle

`check_invite_code` je GRANT na `anon`. Minimum 6 znaků. Formátem je
boolean oracle pro brute-force. Skutečný gate v `handle_new_user` je OK;
RPC na anona je navíc.

**Fix:** rate-limit / lockout; nevracet boolean anonu (nechat selhat až
signup trigger); delší kód; po N špatných pokusech dočasně vypnout
registraci.

---

## Produkt a informační architektura

PRODUCT.md: *„Neveřejný, kamarádský tipovací nástroj… bez peněz, bez
veřejné soutěže.“* Realita v kódu je bohatší — a ne vždy v dobrém.

| Surface | Verdikt |
|---|---|
| Fight card + uzávěrka | Jádro. Držet, dál zrychlovat. |
| Žebříček + compare + tipper modal | Jádro po gala. Scoring legenda je schovaná (`B-14`). |
| Startovné 50 Kč P2P + QR | Funguje jako checklist, ne platba. OK pro partu; nesmí unikat účet (viz P0). |
| Kecárna + GIF + reakce | Na fight night dává smysl. Tři ~600řádkové client ostrovy vedle 14 karet tipu jsou drahé. |
| Live poll / watching-now | Zábava navíc. Není v PRODUCT purpose. |
| **Skupiny v bottom nav** | Produkt už *je* jedna uzavřená skupina. Čtvrtá položka navu na mobilu krade palec od Galavečery / Žebříček / Profil. |
| Wrapped | Jednou ročně, v pořádku jako „poster“ surface. |
| Admin | Potřebný. `is_admin` vs `is_superadmin` je nekonzistentní (superadmin bez `is_admin` se na `/admin/events/[id]` odrazí). |

**Doporučení (produkt, ne vizuál):**

1. **Vyhodit Skupiny z primary nav.** Přesunout pod Profil jako „Mini-ligy“,
   nebo feature flag / schovat, dokud parta fakt nehraje víc tabulek.
   Čtyři taby na palec u ~10 lidí, kteří jsou jedna skupina, je špatný trade.
2. **Dark default, ne `system`.** PRODUCT.md říká dark-first; layout má
   `defaultTheme="system"`. První visit na iPhonu ve dne = light mode, na
   který glass/plakáty nejsou stavěné.
3. **`/pravidla` navázat odkud se hraje.** Legenda na žebříčku je sbalená;
   nováček (nebo kámoš co přijde v půlce sezóny) pravidla nepotká, dokud
   je nehledá. Jeden řádek „Jak se počítá“ vedle podium, odkaz na
   `/pravidla#body`.
4. **Nepřidávat další delight.** Motion systém je hotový a disciplinovaný.
   Další konfety / bounce = šum ve špičce před uzávěrkou.

Zbylý design backlog (`B-11`, `B-13`–`B-26` kromě už hotových) je pořád
platný, ale **pod** bezpečnostní vlnou. Nic z něj není P0.

---

## Architektura — konkrétní tření

### Příliš velcí klienti na nejdůležitější stránce

`fight-tip-card.tsx` (~630), `event-comments.tsx` (~640),
`fast-tip-overlay.tsx` (~633). Fast-tip **duplikuje** `predictions.upsert`.
Na gala night je to 14 hydratovaných karet + chat + overlay + realtime.

**Fix:** jeden `persistTip()` (lib nebo server action), presentational
split. Server action by navíc uzavřel P0 se `points` (klient by sloupec
vůbec neposílal).

### Auth amplification

Každá navigace: `proxy` `getUser` + `NavBar` getUser/profile + page
getUser. Na 10 lidí je to OK. Stojí to za sjednocení gate v proxy, ne za
přidávání dalších `getUser` do layoutu.

### Waterfally, které cache na event detailu už vyřešila

- `/profile`: žádný `Suspense`, `StartovneStats` N+1 na
  `event_leaderboard` per gala. `NemesisCard` už umí `.in("event_id", …)`.
- `/events`: po parallel auth+list ještě profil, pak tip counts.
- Leaderboard čeká na seznam eventů, i když `eventId` už je v URL.

### Žádný `error.tsx` / `not-found.tsx` / `global-error.tsx`

`notFound()` a pád renderu = default Next chrome, ne GARÁŽ. `ErrorReporter`
chytá jen `window.error`, ne React error boundary.

### Typy z databáze se negenerují

Žádný `database.types.ts`. Joiny se castují `as unknown as`. Schema drift
padá až v runtime. `supabase gen types` + `npm run db:types` by se zaplatil
u první rozbité relace.

### DX díry

Chybí root `README.md` a `.env.example`. Ops znalost je v
`scraper/README.md`, komentářích workflow a v hlavě. Nový clone neví, že
potřebuje `SUPABASE_SERVICE_ROLE_KEY`, `REVALIDATE_SECRET`, `CRON_SECRET`,
`GITHUB_DISPATCH_TOKEN`, VAPID, Giphy.

`src/lib/perf.ts` loguje `[perf] event/${id}` na každém renderu ve
Vercelu — vypnout, nebo za `PERF_LOG=1`.

---

## Testy — mezera proti zralosti CI

| Vrstva | Stav | Díra |
|---|---|---|
| Playwright | login chrome, 3 unauth redirecty, manifest/SW | Žádný přihlášený flow; `/events` není gated v testu; žádný tip |
| TS unit | 0 | `calculate_points` zrcadlo, `cz-payment`, lock math, revalidate fan-out |
| Scraper | 10 pytest modulů | nejzdravější část repo |
| RLS | implicitně appkou | žádný policy test; service-role cache je footgun |

Jeden Vitest soubor na `czAccountToIban` / `buildSpdString` a jeden na
`scoreBreakdown` vs. SQL pravidla by chytil drift, kvůli kterému se body
hádají s UI. Jeden authenticated Playwright „otevři gala → ulož tip“ by
chytil produkt.

---

## Sada vylepšení (vlny)

Řazené podle toho, co by se rozbilo, kdyby zvací kód unikl, nebo kdyby
někdo z party uměl otevřít Network panel. Ne podle toho, co je vizuálně
vděčné.

### Vlna 0 — ověřit, ne spekulovat (před migracemi)

1. Z anon klíče `GET /rest/v1/profiles?select=nickname,bank_account,is_admin`.
   Pokud `bank_account` přijde, P0 je potvrzené v produkci, ne jen v SQL.
2. Z přihlášeného klienta `PATCH predictions` s `{ points: 3 }` na
   odemčený fight, pak SELECT `event_leaderboard`.
3. Kliknout „Udělat adminem“ v UI a zkontrolovat, že se `is_admin` fakt
   změní. Pokud ne, P1 promote je potvrzené.

Bez tohoto nepsat migraci „naslepo“ proti produkční party.

### Vlna 1 — integrita a soukromí (musí)

| # | Co | Proč | Riziko zásahu |
|---|---|---|---|
| E-1 | RLS: `bank_account` (a role flagy) pryč z veřejného SELECT | GDPR / kamarádské peníze | Střední — QR platba musí pořád vidět účet vítěze; udělat RPC/view |
| E-2 | Zakázat klientský zápis `points` + omezit `recalculate_*` | Leaderboard je hra | Střední — herní data; přepočty nechat scraperu/adminovi |
| E-3 | Opravit `protect_is_admin` / `admin_set_user_admin` | Admin UI lže | Nízké, pokud se vrátí původní override |
| E-4 | Auth v `proxy.ts` + `/events` za loginem | Seznam galavečerů není veřejný produkt | Nízké |
| E-5 | `security_invoker` (nebo ekvivalent) na leaderboard views | Pre-lock leak účasti | Střední — ověřit, že žebříček po locku pořád funguje |
| E-6 | Invite: žádný anon boolean oracle, delší kód | Jediná zeď před REST API | Nízké |

Tohle je jediná vlna, kterou bych dal před další design sprint.

### Vlna 2 — produkt utáhnout (mělo by)

| # | Co | Proč |
|---|---|---|
| E-7 | Skupiny ven z bottom nav (Profil, nebo schovat) | 3 primární taby: Gala / Žebříček / Já |
| E-8 | `defaultTheme="dark"` | Dark je identita, ne preference systému |
| E-9 | Pravidla objevitelná z žebříčku + první tip (`B-14` + `/pravidla`) | Nováček v půlce sezóny |
| E-10 | `error.tsx` / `not-found.tsx` / `global-error.tsx` v hlasu GARÁŽ | Pád nemá vypadat jako Next default |
| E-11 | Sjednotit `is_admin` vs `is_superadmin` na admin event page | Superadmin-only účet je dnes poloviční |

### Vlna 3 — fight-night výkon a údržba

| # | Co | Proč |
|---|---|---|
| E-12 | `persistTip()` + rozsekat 3× ~600řádkové ostrovy | Duplicitní upsert, nejteplejší path |
| E-13 | Profile: `Suspense` + `StartovneStats` jedním `.in()` | Zbytečný waterfall / N+1 |
| E-14 | Generovat Supabase typy (`db:types`) | Konec `as unknown as` |
| E-15 | Root README + `.env.example` | Ops není v hlavě |
| E-16 | Vitest: scoring mirror, CZ IBAN/QR, revalidate fan-out | CI teď nechrání hru |
| E-17 | Playwright: `/events` gated + jeden authenticated tip | Smoke dnes testuje chrome, ne produkt |

### Vlna 4 — zbylý design backlog (až bude 1–3 klid)

Vzit z `docs/design-backlog.md` bez herní logiky: **B-11, B-13, B-17–B-22,
B-23–B-26**. `B-16` (loading na tipper detail) už v tree je. `B-27` bounce
ponechat (záměr). `B-28` ignorovat (limit token formátu). `B-29` (Inter na
OG) odložit.

Nepouštět nový `/impeccable` běh, dokud vlna 1 není v migracích. Design
systém je v dobrém stavu (audit ~16/20); další polish by maskoval RLS díry.

---

## Co záměrně nedělat

- **Nepřepisovat scoring do TypeScriptu.** Zůstat v SQL; appka jen zobrazuje.
- **Nedávat Stripe / escrow.** Startovné je honor-system P2P a PRODUCT.md to
  chce. Po E-1 je to v pořádku.
- **Nevracet GitHub `schedule:`** u scraperu. Externí cron + heartbeat je
  poučené.
- **Nepřidávat animační knihovnu** ani další ambient motion.
- **Nemergeovat skupiny do „platformy“.** Buď mini-ligy schovat, nebo je
  fakt používat — ne nechat čtvrtý tab „pro jistotu“.
- **Nesahat na `lock_at` / draft gate** bez testu. B-1 (countdown →
  `router.refresh()`) už je v kódu; `events.status = 'locked'` se nikdy
  nezapisuje — to je dokumentovaný stav, ne nutně bug, dokud `lock_at`
  není null.

---

## Navrhovaný první PR po tomhle review

Ne tento dokument. První kódový PR:

1. Migrace: profiles column split + `points` revoke + recalc REVOKE +
   `protect_is_admin` override zpět.
2. `proxy.ts` auth allowlist.
3. Dva testy: RLS (nebo aspoň dokumentovaný SQL check v `docs/`) +
   Playwright `/events` → `/login`.

Až to projde na preview proti kopii DB, teprve E-7–E-11.

---

## Mapování na existující dokumenty

| Dokument | Role po tomhle review |
|---|---|
| `docs/design-backlog.md` | Zbylé P2/P3 vizuál — vlna 4 |
| `docs/impeccable-run.md` | BRÁNA E může merge design větve; tenhle text ji nenahrazuje |
| `PRODUCT.md` | Po E-7/E-8 zvážit jednu větu: skupiny nejsou primary nav; dark je default |
| `DESIGN.md` | Není třeba měnit teď |
