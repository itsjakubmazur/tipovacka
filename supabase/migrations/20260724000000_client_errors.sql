-- Self-hosted client error log: uncaught browser errors get written
-- here by the ErrorReporter component instead of vanishing until
-- someone sends a screenshot. Deliberately no external service - the
-- superadmin error page in /admin is the whole pipeline.
create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  message text not null,
  stack text,
  url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index client_errors_created_idx on public.client_errors(created_at desc);

alter table public.client_errors enable row level security;

create policy client_errors_insert_own on public.client_errors
  for insert with check (auth.uid() = user_id);

create policy client_errors_select_superadmin on public.client_errors
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_superadmin)
  );

create policy client_errors_delete_superadmin on public.client_errors
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_superadmin)
  );
