-- Archiv galavečerů OKTAGONU: turnaje, které parta nikdy netipovala, ale
-- chceme je mít v appce kompletní - plakát, kartu, výsledky, statistiky.
--
-- Od téhle migrace `events` obsahuje dvě různé věci a každý dotaz musí říct,
-- kterou z nich myslí:
--   is_archive = false  → naše galavečery, ty se tipují a bodují
--   is_archive = true   → archiv, jen ke čtení
--
-- Bodování se archivu nedotkne samo od sebe: event_leaderboard i
-- season_leaderboard se odvozují od tipů, a na archivní galavečer nikdo
-- tipovat nemůže (predictions_insert_own vyžaduje event, který není
-- completed). Ohlídat je potřeba výpisy a notifikace - viz docs/shape-oktagon-archive.md.
alter table public.events add column if not exists is_archive boolean not null default false;

-- Skoro každý dotaz nad events chce "jen naše" a archiv je proti nim
-- v přesile zhruba deset ku jedné.
create index if not exists events_is_archive_idx on public.events (is_archive);

comment on column public.events.is_archive is
  'Historický turnaj OKTAGONU doimportovaný jen ke čtení - parta ho netipovala. '
  'Nikdy nesmí vstupovat do žebříčků, statistik sezóny ani notifikací.';
