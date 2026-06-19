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
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | vygenerováno pro push notifikace, viz sekce "Push notifikace" níže |

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

Lze je spustit ručně přes GitHub Actions workflow `sherdog-scraper.yml`
(GitHub → Actions → Sherdog scraper → Run workflow, vyber `mode` a
vyplň `event_id`), ale za normálního provozu to dělá automaticky
`scraper/cron.py` (viz níže) - manuální spuštění je hlavně pro případ, že
by automatika z nějakého důvodu zaspala.

### Automatický cron (`scraper/cron.py`)

Jeden GitHub Actions workflow (`scraper-cron.yml`) spouští `cron.py` každých
15 minut a ten postupně:

1. **Naimportuje kartu nového galavečera** - jakmile má `events` vyplněnou
   `sherdog_event_url` alespoň 5 minut (aby se nestáhla karta uprostřed
   rozeditování v adminu) a ještě nemá žádné zápasy, stáhne kartu ze
   Sherdogu a pošle push "karta je online" všem.
2. **Znovu zkontroluje kartu** - u galavečerů, co ještě nejsou uzamčené,
   jednou za ~3 hodiny znovu stáhne kartu a porovná ji s tím, co je v
   Supabase. Pokud se něco změnilo (nový zápas, zrušený zápas - typicky
   short notice náhrada), pošle push "karta se změnila".
3. **Pošle připomínku uzávěrky** - hodinu před `lock_at` push všem
   přihlášeným k notifikacím (i těm, co už tipovali - upozorňuje i na
   možné short-notice změny karty).
4. **Zkusí stáhnout výsledky** - u každého galavečeru, co už začal, ale
   ještě nemá `status = completed`, zavolá `import_results.py`. Je to
   bezpečné spustit opakovaně - pokud Sherdog výsledky ještě nemá, skript
   se jen tiše ukončí a zkusí to znovu příští běh. Jakmile se galavečer
   vyhodnotí (všechny zápasy odehrané), pošle push "výsledky jsou hotové".

Je to vědomě jeden workflow s jedním cronem místo několika - GitHub Actions
účtuje běh joby s minimem 1 minuta bez ohledu na to, jak dlouho skript
opravdu běžel, takže víc samostatných častých cronů by zbytečně rychle
vyčerpalo měsíční limit free minut (zvlášť u private repa).

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

## Push notifikace

Uživatel si v `/profile` může zapnout push upozornění. Posílají se čtyři typy
(viz `scraper/cron.py` výše): nová karta je online, karta se změnila,
uzávěrka tipů za hodinu, a výsledky galavečera jsou hotové. Funguje přes
Web Push API a service worker (`public/sw.js`); odesílání řeší sdílený
modul `scraper/push.py`, voláný z `scraper/cron.py`.

Potřebné VAPID klíče se vygenerují jednou (`npx web-push generate-vapid-keys`)
a nastaví takto:

| Proměnná | Kam |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel → Project Settings → Environment Variables (veřejný klíč, bezpečné dát do appky) |
| `VAPID_PUBLIC_KEY` | GitHub repo secret (stejná hodnota jako výše) |
| `VAPID_PRIVATE_KEY` | GitHub repo secret — **nikdy nevkládat do appky/repa**, jen sem |
| `VAPID_SUBJECT` | GitHub repo secret, např. `mailto:tvuj@email.cz` (kontakt požadovaný VAPID specifikací) |

Test, jak notifikace vypadá, bez čekání na reálnou uzávěrku: GitHub → Actions
→ **Test push notification** → Run workflow → vyplň svůj e-mail. Pošle se jen
tobě (vyžaduje, abys měl push v `/profile` zapnutý).

## Nasazení

Aplikace se nasazuje na Vercel, napojený na toto (private) GitHub repo —
auto-deploy při každém pushi na `main`. Env proměnné (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) se vkládají ve Vercel → Project Settings →
Environment Variables.
