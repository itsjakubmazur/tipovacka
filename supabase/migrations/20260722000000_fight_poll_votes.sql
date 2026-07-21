-- One-tap "who takes this one?" poll pinned in the kecárna during a
-- live gala - separate from predictions (those are locked by then;
-- this is just for fun while watching). One vote per user per fight,
-- revotable by tapping the other side.
create table public.fight_poll_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  fight_id uuid not null references public.fights(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  fighter_id uuid not null references public.fighters(id),
  created_at timestamptz not null default now(),
  unique (fight_id, user_id)
);

create index fight_poll_votes_event_idx on public.fight_poll_votes(event_id);

alter table public.fight_poll_votes enable row level security;

create policy fight_poll_votes_select_authenticated on public.fight_poll_votes
  for select using (auth.uid() is not null);

create policy fight_poll_votes_insert_own on public.fight_poll_votes
  for insert with check (auth.uid() = user_id);

create policy fight_poll_votes_update_own on public.fight_poll_votes
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fight_poll_votes'
  ) then
    alter publication supabase_realtime add table public.fight_poll_votes;
  end if;
end $$;
