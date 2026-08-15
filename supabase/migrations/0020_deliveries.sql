-- Partial delivery support: a purchase can now sit in "partial" while some of
-- the ordered quantity has arrived and the rest is still pending.  Each batch
-- that arrives gets its own row in `deliveries` so the lab has a full audit
-- trail of what came when and who signed for it.

alter type public.purchase_status add value 'partial' after 'transit';

create table public.deliveries (
  id                uuid primary key default gen_random_uuid(),
  purchase_id       uuid not null references public.purchases (id) on delete cascade,
  quantity_received text not null check (char_length(trim(quantity_received)) between 1 and 200),
  notes             text not null default '',
  received_by       uuid not null references public.profiles (id) on delete restrict,
  created_at        timestamptz not null default now()
);

alter table public.deliveries enable row level security;
create policy "open read"   on public.deliveries for select using (true);
create policy "open insert" on public.deliveries for insert with check (true);
create policy "open update" on public.deliveries for update using (true);
create policy "open delete" on public.deliveries for delete using (true);

alter publication supabase_realtime add table public.deliveries;
