-- Custom lists for MB Lab Procurement (enzyme lists, chemical lists, etc.)
-- Run in the Supabase SQL editor.

create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(trim(title)) between 1 and 120),
  description text default '',
  columns     jsonb not null default '[]'::jsonb,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index lists_created_idx on public.lists (created_at desc);

create trigger set_lists_updated_at
  before update on public.lists
  for each row execute function public.touch_updated_at();

create table public.list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 200),
  checked     boolean not null default false,
  data        jsonb not null default '{}'::jsonb,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index list_items_list_idx on public.list_items (list_id, sort_order);

-- ---------------------------------------------------------------- RLS
alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy "Anyone can read lists"
  on public.lists for select using (true);
create policy "Anyone can insert lists"
  on public.lists for insert with check (true);
create policy "Anyone can update lists"
  on public.lists for update using (true) with check (true);
create policy "Anyone can delete lists"
  on public.lists for delete using (true);

create policy "Anyone can read list_items"
  on public.list_items for select using (true);
create policy "Anyone can insert list_items"
  on public.list_items for insert with check (true);
create policy "Anyone can update list_items"
  on public.list_items for update using (true) with check (true);
create policy "Anyone can delete list_items"
  on public.list_items for delete using (true);

-- ---------------------------------------------------------------- Realtime
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_items;
