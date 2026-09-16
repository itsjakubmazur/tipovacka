-- Dvě věci pro profil bojovníka: dát se najít, a mít co ukázat.

-- 1) Hledání podle jména.
--
-- Nikdo nebude do mobilu psát háčky, takže "vemola" musí najít "Vémola"
-- a "strbak" najde "Štrbák". unaccent() ale není IMMUTABLE ve své
-- jednoargumentové podobě (závisí na search_path), takže ho nejde dát přímo
-- do generovaného sloupce - proto ten obal s explicitně pojmenovaným
-- slovníkem, což je standardní recept.
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.immutable_unaccent(text)
  returns text
  language sql
  immutable
  parallel safe
  strict
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

comment on function public.immutable_unaccent(text) is
  'unaccent() s pevně daným slovníkem, aby šel použít v generovaném sloupci a v indexu.';

-- Přezdívka je součástí hledání schválně: půlka party si pamatuje "T-800"
-- spíš než Pütze.
alter table public.fighters
  add column if not exists search_name text
  generated always as (
    public.immutable_unaccent(lower(coalesce(name, '') || ' ' || coalesce(nickname, '')))
  ) stored;

comment on column public.fighters.search_name is
  'Jméno + přezdívka bez diakritiky a malými písmeny - jediné, na co se ptá hledání bojovníka.';

-- Trigram, ne prefixový index: hledá se i uprostřed jména (příjmení je
-- často to jediné, co si člověk pamatuje).
create index if not exists fighters_search_name_trgm_idx
  on public.fighters using gin (search_name extensions.gin_trgm_ops);

-- 2) Kam údery dopadaly.
--
-- Trackovací systém u každého úderu hlásí i `target` (head/body/legs) a
-- OKTAGON z toho na webu kreslí "ÚDERY PODLE OBLASTI ZASAŽENÍ". Dosud jsme
-- z payloadu brali jen počty, takže se ta část zahazovala.
--
-- jsonb, ne tři sloupce na stranu: cílové oblasti jsou jejich číselník, ne
-- náš, a kdyby přibyla čtvrtá, nechceme kvůli tomu migraci.
alter table public.fight_stats
  add column if not exists fighter_a_targets jsonb not null default '{}'::jsonb,
  add column if not exists fighter_b_targets jsonb not null default '{}'::jsonb;

comment on column public.fight_stats.fighter_a_targets is
  'Počty zásahů podle oblasti, jak je hlásí tracking ({"head": 12, "body": 3, "legs": 7}).';
comment on column public.fight_stats.fighter_b_targets is
  'Počty zásahů podle oblasti, jak je hlásí tracking ({"head": 12, "body": 3, "legs": 7}).';
