# Tipovačka scraper

Python jobs that keep the app in sync with OKTAGON: they create and publish
events, import fight cards and results, refresh odds, and send push
notifications. Everything runs through `cron.py`, invoked on a schedule by an
**external** trigger (see below).

## How it runs

`python cron.py` does one full pass: auto-create/publish events, import & recheck
cards, refresh odds, grade results, and fire the various notifications. It's
meant to be called every few minutes.

GitHub Actions' own `schedule:` cadence is unreliable, so the tick is driven by
an external scheduler (**cron-job.org**) that pings the `scraper-cron.yml`
workflow. That means: **if the external scheduler stops, nothing runs and the
per-task failure alerts never fire.** The heartbeat below exists for exactly
that case.

## Environment variables

Required:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS; keep secret) |
| `VAPID_PRIVATE_KEY` | Web-push VAPID private key |
| `VAPID_SUBJECT` | VAPID subject (e.g. `mailto:you@example.com`) |

Optional:

| Variable | Purpose |
| --- | --- |
| `HEALTHCHECK_URL` | Dead-man's-switch ping (see below) |

## Monitoring / dead-man's switch

Two independent layers:

1. **Failure alerts** — every task runs inside `log_run` (see `run_logger.py`).
   If the same job fails 3 runs in a row, admins get a push. Visible in-app at
   **Admin → Log scraperu**.

2. **Heartbeat** — `record_heartbeat()` stamps `cron_heartbeat.last_run_at` each
   tick. On waking after a gap longer than `HEARTBEAT_OUTAGE_THRESHOLD`
   (30 min), it pushes admins so a scheduler outage doesn't pass unnoticed. The
   admin log shows a live **"Scraper běží / možná stojí"** banner.

   The heartbeat only catches an outage *once the scraper runs again*. To catch a
   **total** outage (scheduler never fires) from the outside, set
   `HEALTHCHECK_URL`:

   1. Create a free check at <https://healthchecks.io> (or any dead-man's-switch
      service). Set its period a bit above your tick interval (e.g. 15 min) with
      a grace window.
   2. Copy the check's ping URL into the `HEALTHCHECK_URL` env var for the
      scraper (GitHub Actions secret / workflow env).
   3. Each successful `cron.py` run pings it. If pings stop, healthchecks.io
      emails/alerts you — even if the whole pipeline is down.

   If `HEALTHCHECK_URL` is unset, the ping is skipped silently; everything else
   works unchanged.

## Tests

```
python -m pytest
```

## Generálka před galavečerem

`python rehearsal.py` projde celý večer na zahazovacím galavečeru: založí ho,
naimportuje fiktivní kartu, natipuje za všechny profily, posune uzávěrku,
odboduje zápas po zápasu, zapíše Fight of the Night, uzavře galavečer a po
každém kroku zkontroluje, že se žebříček a body chovají, jak mají. Nakonec po
sobě uklidí.

```
python rehearsal.py              # suchý běh, žádné notifikace neodejdou
python rehearsal.py --with-push  # opravdu odešle push (jen na dev projektu!)
python rehearsal.py --keep       # zkušební galavečer nechá v databázi
```

Startovné má vypnuté, takže zkouška nikdy nevyrobí dluh mezi skutečnými lidmi.
Píše přes service-role klíč, takže RLS neplatí — **nikdy to nepouštěj proti
produkci s `--with-push`.**

Co to nezkontroluje: jak vypadají obrazovky. Po generálce projdi ručně
`/events/<id>`, žebříček a admin detail.
