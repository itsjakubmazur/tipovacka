-- Sledovačka: koukání na galavečer společně v garáži u Rejdoše.
--
-- Nekoná se pokaždé, je vždycky ve stejné garáži a zapíná ji jedině admin -
-- takže to nejsou vlastní entity, ale tři nastavení galavečera. Tím pádem
-- zapínání a vypínání už pokrývá existující policy events_admin_write
-- i revalidační webhook nad `events`; nová je jen tabulka s odpověďmi.

alter table public.events
  add column if not exists watch_party_enabled boolean not null default false,
  -- null = "od začátku galavečera", UI si dosadí lock_at
  add column if not exists watch_party_starts_at timestamptz,
  add column if not exists watch_party_note text;

alter table public.events
  drop constraint if exists events_watch_party_note_length;

alter table public.events
  add constraint events_watch_party_note_length
  check (watch_party_note is null or char_length(watch_party_note) <= 500);

create table public.watch_party_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  -- kolik lidí navíc přivedu: 0 = "přijdu sám", 1+ = "přijdu s někým".
  -- Dává smysl jen u 'yes' - ostatní odpovědi drží nulu, aby se starý počet
  -- hostů tiše nezapočítal, když si to někdo za týden rozmyslí zpátky.
  plus_ones integer not null default 0 check (plus_ones between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id),
  check (answer = 'yes' or plus_ones = 0)
);

create trigger watch_party_rsvps_set_updated_at
  before update on public.watch_party_rsvps
  for each row execute function public.set_updated_at();

alter table public.watch_party_rsvps enable row level security;

grant select, insert, update, delete on public.watch_party_rsvps to authenticated;

-- Kdo dorazí je celý smysl věci - odpovědi vidí všichni. Schválně naopak než
-- u presence v WatchingNow: tohle si člověk zapíná sám a právě proto, aby to
-- ostatní věděli.
create policy watch_party_rsvps_select_authenticated on public.watch_party_rsvps
  for select using (auth.uid() is not null);

-- Odpovídáš za sebe, a jen dokud sledovačka běží a galavečer není
-- vyhodnocený. Po vyhodnocení je z karty vzpomínka na ten večer, takže se
-- přestane dát přepsat tady dole, ne jen v UI.
create policy watch_party_rsvps_insert_own on public.watch_party_rsvps
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = watch_party_rsvps.event_id
        and e.watch_party_enabled
        and e.status <> 'completed'
    )
  );

create policy watch_party_rsvps_update_own on public.watch_party_rsvps
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = watch_party_rsvps.event_id
        and e.watch_party_enabled
        and e.status <> 'completed'
    )
  );

create policy watch_party_rsvps_delete_own_or_admin on public.watch_party_rsvps
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Živé odpovědi: detail galavečera už jedním RealtimeRefreshem sleduje
-- několik tabulek, tahle se k nim přidá.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'watch_party_rsvps'
  ) then
    alter publication supabase_realtime add table public.watch_party_rsvps;
  end if;
end $$;
