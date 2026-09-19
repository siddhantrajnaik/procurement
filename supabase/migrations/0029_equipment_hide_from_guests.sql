-- Keep an instrument off the visitor list.
-- Run in the Supabase SQL editor after previous migrations.
--
-- Not everything in the lab should be offered to whoever walks in. This hides
-- the instrument from the guest shell only: lab members and the PI still see it
-- exactly as before, and any usage already logged against it is untouched.
--
-- Default false, so every instrument stays visible until somebody decides
-- otherwise -- the safe direction for a lab that has been running without this.

alter table public.equipment
  add column hide_from_guests boolean not null default false;
