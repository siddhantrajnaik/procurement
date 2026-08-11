-- MB Lab Procurement — inventory management
-- Run in the Supabase SQL editor after 0001_init.sql.

create type public.inventory_action as enum (
  'added', 'moved', 'consumed', 'restocked', 'arrived', 'adjusted', 'removed'
);

create table public.inventory_items (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(trim(name)) between 1 and 200),
  category            text not null default 'General',
  quantity            numeric(12, 2) not null default 0 check (quantity >= 0),
  unit                text not null default 'pcs',
  location            text not null default '',
  low_stock_threshold numeric(12, 2) check (low_stock_threshold is null or low_stock_threshold >= 0),
  notes               text,
  linked_purchase_id  uuid references public.purchases (id) on delete set null,
  added_by            uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.inventory_log (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.inventory_items (id) on delete cascade,
  item_name       text not null,
  action          public.inventory_action not null,
  quantity_change numeric(12, 2),
  old_location    text,
  new_location    text,
  actor_id        uuid references public.profiles (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes

create index inventory_items_category_idx on public.inventory_items (category);
create index inventory_items_updated_idx  on public.inventory_items (updated_at desc);
create index inventory_log_item_idx       on public.inventory_log (item_id, created_at desc);
create index inventory_log_created_idx    on public.inventory_log (created_at desc);

-- ---------------------------------------------------------------- triggers

create trigger inventory_items_touch_updated_at
  before update on public.inventory_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- row level security

alter table public.inventory_items enable row level security;
alter table public.inventory_log   enable row level security;

create policy "inventory items are readable" on public.inventory_items
  for select to anon, authenticated using (true);
create policy "inventory items are insertable" on public.inventory_items
  for insert to anon, authenticated with check (true);
create policy "inventory items are updatable" on public.inventory_items
  for update to anon, authenticated using (true) with check (true);
create policy "inventory items are deletable" on public.inventory_items
  for delete to anon, authenticated using (true);

create policy "inventory log is readable" on public.inventory_log
  for select to anon, authenticated using (true);
create policy "inventory log is insertable" on public.inventory_log
  for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table public.inventory_items;
alter publication supabase_realtime add table public.inventory_log;
