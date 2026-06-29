create table if not exists public.form_studio_documents (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.form_studio_documents enable row level security;

drop policy if exists "Public can read form studio data" on public.form_studio_documents;
create policy "Public can read form studio data"Q
on public.form_studio_documents
for select
to anon
using (true);

drop policy if exists "Public can create form studio data" on public.form_studio_documents;
create policy "Public can create form studio data"
on public.form_studio_documents
for insert
to anon
with check (true);

drop policy if exists "Public can update form studio data" on public.form_studio_documents;
create policy "Public can update form studio data"
on public.form_studio_documents
for update
to anon
using (true)
with check (true);
