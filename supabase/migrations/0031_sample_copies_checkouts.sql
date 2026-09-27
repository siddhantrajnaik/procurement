-- Sample copies and check-outs.
-- Run in the Supabase SQL editor after 0030_pi_reminders.sql.
--
-- copies: how many containers of this sample sit in its box, so three bottles
-- of KCl are one row "×3" rather than three rows.
--
-- sample_checkouts: one row each time somebody takes a container out. It stays
-- open (returned_at null) until it comes back, so the box can say "1 out —
-- Rupam, 2 h ago" and a second person taking another copy does not overwrite
-- who has the first.

alter table public.samples
  add column copies integer not null default 1 check (copies >= 1);

create table public.sample_checkouts (
  id           uuid primary key default gen_random_uuid(),
  sample_id    uuid not null references public.samples (id) on delete cascade,
  taken_by     uuid not null references public.profiles (id) on delete cascade,
  taken_at     timestamptz not null default now(),
  returned_at  timestamptz,
  returned_by  uuid references public.profiles (id) on delete set null
);

-- The only question ever asked of this table is "what is out right now".
create index sample_checkouts_open_idx
  on public.sample_checkouts (sample_id)
  where returned_at is null;

-- row level security — same "curtain, not a wall" as the rest of the app.
alter table public.sample_checkouts enable row level security;

create policy "open read"   on public.sample_checkouts for select using (true);
create policy "open insert" on public.sample_checkouts for insert with check (true);
create policy "open update" on public.sample_checkouts for update using (true);
create policy "open delete" on public.sample_checkouts for delete using (true);

alter publication supabase_realtime add table public.sample_checkouts;

-- Adding "two more KCl" must not be read-modify-write on the phone: two people
-- topping up the same row at once would each write back their own stale count.
create or replace function public.add_sample_copies(p_sample_id uuid, p_delta integer)
returns integer
language sql
as $$
  update public.samples
     set copies = greatest(1, copies + p_delta)
   where id = p_sample_id
  returning copies;
$$;

grant execute on function public.add_sample_copies(uuid, integer) to anon, authenticated;
