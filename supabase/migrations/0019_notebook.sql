-- Lab Notebook: personal Notion-like pages, one row per page.
-- Pages are scoped to their author in the UI (added_by = current user). Like the
-- rest of this app there is no Supabase Auth session, so RLS stays open and the
-- filtering happens client-side — see the note in 0001_init.sql.

create table if not exists public.notebook_pages (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Untitled',
  icon        text not null default '📄',
  body        text not null default '',
  drive_links jsonb not null default '[]'::jsonb,
  added_by    uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notebook_pages_owner_idx
  on public.notebook_pages (added_by, updated_at desc);

alter table public.notebook_pages enable row level security;

create policy "Anyone can read notebook_pages"
  on public.notebook_pages for select using (true);

create policy "Anyone can insert notebook_pages"
  on public.notebook_pages for insert with check (true);

create policy "Anyone can update notebook_pages"
  on public.notebook_pages for update using (true);

create policy "Anyone can delete notebook_pages"
  on public.notebook_pages for delete using (true);

create trigger notebook_pages_touch_updated_at
  before update on public.notebook_pages
  for each row execute function public.touch_updated_at();
