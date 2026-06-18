# OKTAGON Tipovačka

Kamarádská tipovačka na galavečery MMA organizace OKTAGON. Tipuje se vítěz,
způsob ukončení a kolo u každého zápasu; výsledky se po galavečeru natáhnou
ze Sherdogu a body se spočítají automaticky.

## Stack

- **Next.js** (App Router, TypeScript) + **Tailwind CSS** + shadcn/ui komponenty
- **Supabase** (Postgres, Auth, Row Level Security)
- **Python scraper** (Sherdog výsledky) běžící jako GitHub Actions
- **Vercel** hosting

## Vývoj

```bash
npm install
cp .env.local.example .env.local   # vyplň Supabase URL a anon key
npm run dev
```

Otevři http://localhost:3000.

### Potřebné env proměnné (`.env.local`)

| Proměnná | Kde ji najdeš |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |

`SUPABASE_SERVICE_ROLE_KEY` se nikdy nevkládá do appky ani repa — používá ho
jen Python scraper přes GitHub Actions secrets.

## Databáze

SQL migrace jsou v `supabase/migrations`. Aplikace:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Pokud nemáš Supabase CLI propojené, lze stejný SQL vložit ručně do
Supabase → SQL Editor → Run (soubory v `supabase/migrations` se aplikují
v pořadí podle názvu).

## Scraper výsledků

Python skript v `scraper/` stahuje výsledky z Sherdogu a zapisuje je do
Supabase přes service role key. Spouští se přes GitHub Actions
(`.github/workflows`), ručně (`workflow_dispatch`) i podle cronu v okně
galavečera.

## Nasazení

Aplikace se nasazuje na Vercel, napojený na toto (private) GitHub repo —
auto-deploy při každém pushi na `main`. Env proměnné (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) se vkládají ve Vercel → Project Settings →
Environment Variables.
