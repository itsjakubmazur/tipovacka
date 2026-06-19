# OKTAGON GARÁŽ Tipovačka

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

## Sherdog scraper

Python skripty v `scraper/` umí dvě věci, obě bez nutnosti cokoliv zadávat
manuálně:

- **`import_card.py`** - stáhne kartu zápasů (zápasníky + zápasy) z Sherdog
  stránky galavečera a vytvoří je v Supabase (zápasníci se párují podle
  `sherdog_slug`, případně podle jména).
- **`import_results.py`** - po galavečeru stáhne výsledky, doplní vítěze/
  způsob/kolo k existujícím zápasům a zavolá `recalculate_event_points`,
  aby se přepočetly body všem hráčům.

Obě se spouští přes GitHub Actions workflow `sherdog-scraper.yml`:

- **Ručně**: GitHub → Actions → Sherdog scraper → Run workflow, vyber
  `mode` (`card` nebo `results`) a vyplň `event_id` (UUID galavečera ze
  Supabase tabulky `events`).
- **Automaticky**: workflow běží i podle cronu (víkendy, několikrát po
  galavečeru) a sám zkusí stáhnout výsledky pro každý galavečer, který už
  začal, ale ještě nemá vyplněné výsledky. Je to bezpečné spustit
  opakovaně - pokud Sherdog výsledky ještě nemá, skript se jen tiše
  ukončí.

Potřebné GitHub repo secrets (Settings → Secrets and variables → Actions):

| Secret | Hodnota |
|---|---|
| `SUPABASE_URL` | stejná URL jako `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` klíč (nikdy nevkládat do appky/Vercelu) |

Sherdog nemá veřejné API, takže parsování HTML stránky se může při
změně designu rozbít - pokud `import_card.py` nenajde žádné zápasy,
vypíše to do logu Action běhu a je potřeba upravit selektory v
`scraper/sherdog.py`.

### Spuštění importu z admin UI

V `/admin/events/[id]` jde po vyplnění odkazu na Sherdog kliknout na
tlačítko "Stáhnout kartu ze Sherdogu" / "Stáhnout výsledky ze Sherdogu" —
admin appka pak za tebe spustí stejný GitHub Actions workflow (není
potřeba chodit do GitHub → Actions). Aby to fungovalo, appka potřebuje na
Vercelu env proměnnou `GITHUB_DISPATCH_TOKEN` - GitHub osobní token
(fine-grained, scoped jen na tento repo, s oprávněním "Actions: Read and
write"). Bez něj tlačítka vrátí chybu, ale workflow lze stále spustit
ručně přes GitHub → Actions → Run workflow.

## Nasazení

Aplikace se nasazuje na Vercel, napojený na toto (private) GitHub repo —
auto-deploy při každém pushi na `main`. Env proměnné (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) se vkládají ve Vercel → Project Settings →
Environment Variables.
