# OKTAGON GARÁŽ Tipovačka

Uzavřená tipovačka na galavečery OKTAGON MMA pro jednu partu kamarádů.
Next.js (App Router) + Supabase (auth, Postgres, Realtime, RLS) + Python scraper.

Úspěch = parta se baví fight night společně v appce a soutěží o body (a o 50 Kč
startovné mezi sebou, mimo appku).

## Stack

- App: Next.js 16, React 19, Tailwind 4, PWA + Web Push
- Data: Supabase (RLS je autorizační vrstva; browser píše přes anon klíč)
- Scraper / cron / push: `scraper/` (pytest), spouštěné z GitHub Actions přes
  `/api/cron-tick`

## Local setup

```bash
npm ci
cp .env.example .env.local   # doplň klíče
npm run dev
```

Migrace: `supabase/migrations/` — aplikuj proti projektu (`supabase db push`
nebo GitHub workflow `db-migrate`).

```bash
npm run lint
npm run typecheck
npm test
npm run e2e          # smoke proti production buildu, bez živé DB
```

Typy z databáze (vyžaduje nalinkovaný Supabase projekt):

```bash
npm run db:types
```

Scraper: viz `scraper/README.md`.

## Auth

Veřejné jsou jen `/`, `/login`, `/pravidla`, `/auth/*`, `/share/*`, PWA assety
a `/api/*` (cron/revalidate se tajným Bearerem). Zbytek gatuje `src/proxy.ts`.

Registrace drží zvací kód v `handle_new_user` triggeru — formulář ho posílá
v metadata, trigger ho porovná. Anon REST nemá boolean oracle na kód.

## Herní logika

Body počítá SQL (`calculate_points`, views `event_leaderboard` /
`season_leaderboard`). Klient nesmí zapisovat sloupec `points`. Recalc RPC
jsou jen pro admina / service_role.

Čísla účtů žijí v `profile_bank_accounts` (own-row RLS). Účet vítěze pro QR
jde přes RPC `event_winner_bank_account`.
