-- ============================================================
-- Migration 0009 — Booking system (bookable items + time slots)
-- ============================================================

-- Bookable items: user-created resources anyone can reserve
create table public.bookable_items (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  description text not null default '',
  color      text not null default '#8B5CF6',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bookable_items_touch_updated_at
  before update on public.bookable_items
  for each row execute function touch_updated_at();

alter table public.bookable_items enable row level security;

create policy "bookable_items are viewable by everyone"
  on public.bookable_items for select using (true);

create policy "bookable_items are insertable by everyone"
  on public.bookable_items for insert with check (true);

create policy "bookable_items are updatable by everyone"
  on public.bookable_items for update using (true) with check (true);

create policy "bookable_items are deletable by everyone"
  on public.bookable_items for delete using (true);

-- Bookings: time-slot reservations against bookable items
create type public.booking_status as enum ('confirmed', 'cancelled');

create table public.bookings (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.bookable_items(id) on delete cascade,
  booked_by  uuid references public.profiles(id) on delete set null,
  date       date not null,
  start_time time not null,
  end_time   time not null,
  purpose    text not null default '',
  status     public.booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),

  constraint bookings_time_order check (end_time > start_time)
);

alter table public.bookings enable row level security;

create policy "bookings are viewable by everyone"
  on public.bookings for select using (true);

create policy "bookings are insertable by everyone"
  on public.bookings for insert with check (true);

create policy "bookings are updatable by everyone"
  on public.bookings for update using (true) with check (true);

create policy "bookings are deletable by everyone"
  on public.bookings for delete using (true);

-- Prevent overlapping confirmed bookings for the same item
create or replace function check_booking_overlap()
returns trigger as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  if exists (
    select 1 from public.bookings
    where item_id = new.item_id
      and date = new.date
      and status = 'confirmed'
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and start_time < new.end_time
      and end_time > new.start_time
  ) then
    raise exception 'This time slot overlaps with an existing booking.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger bookings_check_overlap
  before insert or update on public.bookings
  for each row execute function check_booking_overlap();

-- Realtime
alter publication supabase_realtime add table public.bookable_items;
alter publication supabase_realtime add table public.bookings;
