-- Serial number on each instrument.
-- Run in the Supabase SQL editor after previous migrations.
--
-- The one identifier a service engineer always asks for on the phone, and the
-- one thing the lab currently has to go and read off the back of the machine.
-- Free text, not unique: the number is whatever the manufacturer stamped on it,
-- and two instruments from different makers can legitimately collide.

alter table public.equipment
  add column serial_number text not null default '';
