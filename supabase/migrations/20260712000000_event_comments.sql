-- Trash-talk wall on the event detail page. Simple flat comments,
-- readable by any signed-in user, writable by their author, deletable
-- by the author or an admin.
create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index event_comments_event_created_idx
  on public.event_comments(event_id, created_at desc);

alter table public.event_comments enable row level security;

create policy event_comments_select_authenticated on public.event_comments
  for select using (auth.uid() is not null);

create policy event_comments_insert_own on public.event_comments
  for insert with check (auth.uid() = user_id);

create policy event_comments_delete_own on public.event_comments
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Live updates for the wall (postgres_changes still respects RLS).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_comments'
  ) then
    alter publication supabase_realtime add table public.event_comments;
  end if;
end $$;
