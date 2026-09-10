-- Instrument usage log and consumable loans, for visiting researchers.
-- Run in the Supabase SQL editor after previous migrations.

-- Both tables are append-only: a log entry is a statement about a moment, and
-- editing one after the fact would defeat the point of keeping it.

create table public.equipment_usage_log (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment (id) on delete cascade,
  -- Free text rather than a profiles FK: visitors are not system users, and the
  -- lab already accepts this shape for maintenance_logs.performed_by.
  visitor_name  text not null check (char_length(trim(visitor_name)) between 1 and 120),
  affiliation   text not null default '',
  purpose       text not null default '',
  -- Set only when a lab member logs usage on someone's behalf.
  user_id       uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.consumable_loans (
  id            uuid primary key default gen_random_uuid(),
  -- Nullable: a visitor may take something that was never in the inventory.
  item_id       uuid references public.inventory_items (id) on delete set null,
  -- Snapshot of the name so the record survives the item being deleted,
  -- matching inventory_log.item_name.
  item_name     text not null check (char_length(trim(item_name)) between 1 and 200),
  -- Text, not numeric: "about 50 mL" is the realistic input and nothing does
  -- stock arithmetic on it. Inventory counts are deliberately left untouched.
  quantity      text not null default '',
  visitor_name  text not null check (char_length(trim(visitor_name)) between 1 and 120),
  affiliation   text not null default '',
  notes         text not null default '',
  user_id       uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- indexes
create index equipment_usage_log_equipment_idx on public.equipment_usage_log (equipment_id, created_at desc);
create index equipment_usage_log_created_idx   on public.equipment_usage_log (created_at desc);
create index consumable_loans_created_idx      on public.consumable_loans (created_at desc);

-- row level security
alter table public.equipment_usage_log enable row level security;
alter table public.consumable_loans    enable row level security;

create policy "open read"   on public.equipment_usage_log for select using (true);
create policy "open insert" on public.equipment_usage_log for insert with check (true);

create policy "open read"   on public.consumable_loans for select using (true);
create policy "open insert" on public.consumable_loans for insert with check (true);

-- realtime
alter publication supabase_realtime add table public.equipment_usage_log;
alter publication supabase_realtime add table public.consumable_loans;
