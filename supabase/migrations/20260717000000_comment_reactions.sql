-- Emoji reactions (tapbacks) on kecárna messages. event_id is
-- denormalized from the comment's event so the app's realtime channel
-- can filter reactions the same way it already filters comments,
-- instead of subscribing to every event's reactions at once.
-- One row per user+comment+emoji: reacting again with the same emoji
-- is a toggle (insert to add, delete to remove) - a user can still
-- react with several different emoji on the same message, same as the
-- popular chat apps this is modeled on.
create table public.event_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.event_comments(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index event_comment_reactions_comment_idx on public.event_comment_reactions(comment_id);
create index event_comment_reactions_event_idx on public.event_comment_reactions(event_id);

alter table public.event_comment_reactions enable row level security;

create policy event_comment_reactions_select_authenticated on public.event_comment_reactions
  for select using (auth.uid() is not null);

create policy event_comment_reactions_insert_own on public.event_comment_reactions
  for insert with check (auth.uid() = user_id);

create policy event_comment_reactions_delete_own on public.event_comment_reactions
  for delete using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_comment_reactions'
  ) then
    alter publication supabase_realtime add table public.event_comment_reactions;
  end if;
end $$;
