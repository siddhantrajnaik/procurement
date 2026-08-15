-- Add expiry date tracking to inventory items.
-- Run in the Supabase SQL editor after previous migrations.

alter table public.inventory_items
  add column expiry_date date;

create index inventory_items_expiry_idx
  on public.inventory_items (expiry_date asc nulls last);
