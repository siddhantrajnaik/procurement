-- Enforce the check-out rules in the database, not on the phone.
-- Run in the Supabase SQL editor after 0031_sample_copies_checkouts.sql.
--
-- 0031 left "never more out than there are copies" and "one return closes one
-- check-out" to the client, where two phones acting at once both read the same
-- stale count: two people could take the last bottle, and two simultaneous
-- returns could leave one check-out open with the bottle already back.

-- Taking: lock the sample row so concurrent takes queue behind each other.
create or replace function public.take_sample(p_sample_id uuid, p_actor uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_copies integer;
  v_out integer;
  v_id uuid;
begin
  select copies into v_copies from public.samples where id = p_sample_id for update;
  if v_copies is null then
    raise exception 'sample not found' using errcode = 'P0002';
  end if;
  select count(*) into v_out from public.sample_checkouts
   where sample_id = p_sample_id and returned_at is null;
  if v_out >= v_copies then
    raise exception 'all copies are already out' using errcode = 'P0001';
  end if;
  insert into public.sample_checkouts (sample_id, taken_by)
  values (p_sample_id, p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- Returning: close exactly one open check-out — the returner's own first, else
-- the oldest — or return null if nothing was out. skip locked means two people
-- returning at once close two different rows instead of one silently losing.
create or replace function public.return_sample(p_sample_id uuid, p_actor uuid)
returns uuid
language sql
set search_path = ''
as $$
  update public.sample_checkouts
     set returned_at = now(), returned_by = p_actor
   where id = (
     select id from public.sample_checkouts
      where sample_id = p_sample_id and returned_at is null
      order by (taken_by = p_actor) desc, taken_at
      limit 1
      for update skip locked
   )
  returning id;
$$;

-- Topping up: strict so a null delta (NaN from the client) is a no-op instead
-- of resetting the count to 1; bounded; never below what is currently out.
create or replace function public.add_sample_copies(p_sample_id uuid, p_delta integer)
returns integer
language plpgsql
strict
set search_path = ''
as $$
declare
  v_out integer;
  v_copies integer;
begin
  if p_delta not between -1000 and 1000 then
    raise exception 'copies change out of range' using errcode = '22003';
  end if;
  select count(*) into v_out from public.sample_checkouts
   where sample_id = p_sample_id and returned_at is null;
  update public.samples
     set copies = greatest(1, v_out, copies + p_delta)
   where id = p_sample_id
  returning copies into v_copies;
  return v_copies;
end;
$$;

grant execute on function public.take_sample(uuid, uuid) to anon, authenticated;
grant execute on function public.return_sample(uuid, uuid) to anon, authenticated;
grant execute on function public.add_sample_copies(uuid, integer) to anon, authenticated;

-- A bottle somebody still has should not vanish from "out" if their profile is
-- ever removed; the profile has to be dealt with first.
alter table public.sample_checkouts drop constraint sample_checkouts_taken_by_fkey;
alter table public.sample_checkouts
  add constraint sample_checkouts_taken_by_fkey
  foreign key (taken_by) references public.profiles (id) on delete restrict;
