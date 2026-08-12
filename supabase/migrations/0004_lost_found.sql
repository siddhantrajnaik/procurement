-- Lost & Found board for MB Lab Procurement
-- Run in the Supabase SQL editor.

create type public.lost_found_status as enum ('open', 'found', 'resolved');

create table public.lost_found_items (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (char_length(trim(title)) between 1 and 120),
  description       text default '',
  location_last_seen text default '',
  status            public.lost_found_status not null default 'open',
  reported_by       uuid references public.profiles (id) on delete set null,
  resolved_by       uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index lost_found_status_idx on public.lost_found_items (status);
create index lost_found_created_idx on public.lost_found_items (created_at desc);

create trigger set_lost_found_items_updated_at
  before update on public.lost_found_items
  for each row execute function public.touch_updated_at();

create table public.lost_found_responses (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.lost_found_items (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  body        text not null check (char_length(trim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index lost_found_responses_item_idx on public.lost_found_responses (item_id, created_at);

-- ---------------------------------------------------------------- RLS
alter table public.lost_found_items enable row level security;
alter table public.lost_found_responses enable row level security;

create policy "Anyone can read lost_found_items"
  on public.lost_found_items for select using (true);
create policy "Anyone can insert lost_found_items"
  on public.lost_found_items for insert with check (true);
create policy "Anyone can update lost_found_items"
  on public.lost_found_items for update using (true) with check (true);
create policy "Anyone can delete lost_found_items"
  on public.lost_found_items for delete using (true);

create policy "Anyone can read lost_found_responses"
  on public.lost_found_responses for select using (true);
create policy "Anyone can insert lost_found_responses"
  on public.lost_found_responses for insert with check (true);
create policy "Anyone can delete lost_found_responses"
  on public.lost_found_responses for delete using (true);

-- ---------------------------------------------------------------- Realtime
alter publication supabase_realtime add table public.lost_found_items;
alter publication supabase_realtime add table public.lost_found_responses;
