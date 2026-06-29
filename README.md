# Form ni Jerah

A mobile-first interview form builder for UC interview work, surveys, and quiz-style forms.

## Current Status

- Stores forms and responses in Supabase.
- Supports creator, editor, and respondent links.
- Supports form and quiz modes.
- Supports required questions, scoring, feedback, and saved responses.
- Uses a UC-inspired green and black interface.
- Ready for public testing through GitHub Pages.

## Tech Stack

- React
- Vite
- Supabase
- CSS responsive layout

## Supabase Setup

Open your Supabase project SQL editor and run:

```sql
create table if not exists public.form_studio_documents (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.form_studio_documents enable row level security;

drop policy if exists "Public can read form studio data" on public.form_studio_documents;
create policy "Public can read form studio data"
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
```

The same SQL is also saved in `supabase-schema.sql`.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

## Check Before Push

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

## Share With Teammates

After pushing to GitHub, send your teammates the repository link.

Live link:

```text
https://20254754-sam.github.io/forensic_form/
```

If the link shows a GitHub Pages setup message, open the repository settings, go to Pages, and set Source to GitHub Actions.

## Future Work

- Add authentication for form creators.
- Add APK packaging after the web version is stable.
