# Shape plan — archiv galavečerů OKTAGONU

Doimportovat celou historii OKTAGONU (od turnaje 1 z roku 2016) tak, aby v
appce vypadala kompletně: plakát, karta, fotky zápasníků, výsledky a tam, kde
existují, i pozápasové statistiky. Parta tyhle turnaje netipovala — jsou jen
ke čtení.

## Rozhodnutí: do `events`/`fights`, ne vedle

Historie bojovníků má vlastní tabulku schválně. Tady je to obráceně: archiv
**musí** do `events`/`fights`, protože jinak nejde použít nic z toho, co appka
kolem karty umí — poster, `FightMatchup` s fotkami, výsledková část, statistiky.
Postavit to vedle by znamenalo druhou, hloupější kopii půlky appky.

Cena za to je, že `events` od téhle chvíle obsahuje dvě různé věci a **každý
dotaz musí říct, kterou myslí**:

| | `is_archive = false` | `is_archive = true` |
| --- | --- | --- |
| kdo to tipoval | parta | nikdo |
| žebříčky, sezóny, startovné | ano | **nikdy** |
| notifikace | ano | **nikdy** |
| admin úpravy | ano | ne |

## Dvě vrstvy obrany

Bodování je v bezpečí samo od sebe: `event_leaderboard` i `season_leaderboard`
se odvozují od tipů a na archivní galavečer nikdo tipovat nemůže —
`predictions_insert_own` vyžaduje event, který není `completed`.

Nebezpečné jsou **notifikace**. `send_followup_notifications` vybírá eventy
podle `status <> draft` + `followup_notified_at is null` a každému profilu pošle
push „galavečer je za námi". Devadesát archivních turnajů = devět set
notifikací. Proto dvě nezávislé pojistky:

1. **Filtr** `is_archive = false` na všech výčtových dotazech nad `events` —
   13 míst v `cron.py`, 5 v `/api/cron-tick`, plus seznam galavečerů, přepínač
   na žebříčku, sezónní statistiky, nemesis, startovné a admin přehled.
2. **Konstrukce** — importér archivnímu eventu rovnou vyplní *všechny* značky
   „už odesláno" (`followup_notified_at`, `card_notified_at`, …). I kdyby
   nějaký budoucí dotaz na filtr zapomněl, nezbude co poslat.

Druhá vrstva je tam proto, že spoléhat na „vypadne to samo podle stavu a data"
je přesně to, co v téhle appce jednou skončilo výpadkem.

## Import

`scraper/import_archive.py --from N --to M` (workflow *Import archive*, po
dávkách kvůli limitu běhu). Pro každý odehraný turnaj:

1. založí/aktualizuje event (`is_archive`, `status=completed`, plakát z
   `coverImage` v `/v1/events/` — jediné místo, kde se poster starého
   galavečera dá ještě získat, protože `import_image` scrapuje homepage a ta
   zná jen aktuální),
2. naimportuje kartu **rovnou s výsledky** (archivní galavečer je odehraný,
   psát ho jako `scheduled` a pak grade-ovat by byla zbytečná okruh přes živou
   výsledkovou cestu),
3. doplní statistiky, když k zápasům jsou.

Historie bojovníků se dopĺňuje zvlášť (`import_fighter_history.py --all`),
protože jeden bojovník nastupuje na mnoha kartách a po eventech by se stahovala
pořád dokola.

Galavečer, který je náš (`is_archive = false`), importér **přeskočí** — to je
první test v `test_import_archive.py`.

## Odhad velikosti

~145 eventů, ~1 000 zápasů, ~800–1 000 bojovníků, ~2 000 řádků historie,
~450 řádků statistik. **Dohromady kolem 5 MB i s indexy**, tedy pod 1 %
free-tier limitu Supabase.

## Co zbývá (UI)

- **Rozdělení přehledu galavečerů po sezónách.** Bez toho je archiv
  nepoužitelný a vyplatí se i bez něj — do dvou let bude našich turnajů přes
  dvacet.
- **Sekce archivu** s vlastním dotazem (`getArchiveEventsShared`), oddělená od
  našich galavečerů.
- **Detail archivního galavečera**: skrýt tipovací UI, startovné, sledovačku a
  kecárnu — u turnaje, který nikdo netipoval, nemají co říct.
