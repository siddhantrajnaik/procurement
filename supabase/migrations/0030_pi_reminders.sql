-- PI reminders — private follow-ups and recurring checks the PI keeps on lab members.
-- Run in the Supabase SQL editor after previous migrations.

create table public.pi_reminders (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(trim(title)) between 1 and 200),
  note          text not null default '',
  due_date      date,
  recurrence    text not null default 'once'
                  check (recurrence in ('once', 'weekly', 'monthly', 'quarterly', 'yearly')),
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index pi_reminders_member_idx on public.pi_reminders (member_id);
create index pi_reminders_due_idx    on public.pi_reminders (completed, due_date);

create trigger pi_reminders_touch_updated_at
  before update on public.pi_reminders
  for each row execute function public.touch_updated_at();

-- row level security — same "curtain, not a wall" as the rest of the app.
-- Nothing here is more sensitive than a purchase's price, which anon can
-- already read; this only stays out of the way because nobody but the PI
-- has the link to the screen that shows it.
alter table public.pi_reminders enable row level security;

create policy "open read"   on public.pi_reminders for select using (true);
create policy "open insert" on public.pi_reminders for insert with check (true);
create policy "open update" on public.pi_reminders for update using (true);
create policy "open delete" on public.pi_reminders for delete using (true);
