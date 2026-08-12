-- Vendor directory for MB Lab Procurement
-- Run in the Supabase SQL editor, or `supabase db push` with the CLI.

create type public.vendor_type as enum ('direct', 'third_party');

create table public.vendors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 120),
  type        public.vendor_type not null default 'direct',
  comment     text default '',
  contact     text default '',
  photo_url   text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index vendors_type_idx on public.vendors (type);

-- Updated-at trigger (same pattern as purchases / inventory_items)
create trigger set_vendors_updated_at
  before update on public.vendors
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.vendors enable row level security;

create policy "Anyone can read vendors"
  on public.vendors for select using (true);

create policy "Anyone can insert vendors"
  on public.vendors for insert with check (true);

create policy "Anyone can update vendors"
  on public.vendors for update using (true) with check (true);

create policy "Anyone can delete vendors"
  on public.vendors for delete using (true);

-- ---------------------------------------------------------------- Realtime
alter publication supabase_realtime add table public.vendors;
