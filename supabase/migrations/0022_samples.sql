-- Sample inventory — boxes and sample tracking.
-- Run in the Supabase SQL editor after previous migrations.

create table public.sample_boxes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 100),
  condition   text not null default '',
  location    text not null default '',
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.samples (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 200),
  box_id      uuid references public.sample_boxes (id) on delete set null,
  container   text not null default '',
  volume      text not null default '',
  notes       text not null default '',
  added_by    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.sample_log (
  id          uuid primary key default gen_random_uuid(),
  sample_id   uuid references public.samples (id) on delete set null,
  action      text not null,
  details     text not null default '',
  actor_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- indexes
create index sample_boxes_created_by_idx on public.sample_boxes (created_by);
create index samples_box_id_idx          on public.samples (box_id);
create index sample_log_sample_idx       on public.sample_log (sample_id, created_at desc);

-- triggers
create trigger sample_boxes_touch_updated_at
  before update on public.sample_boxes
  for each row execute function public.touch_updated_at();

create trigger samples_touch_updated_at
  before update on public.samples
  for each row execute function public.touch_updated_at();

-- row level security
alter table public.sample_boxes enable row level security;
alter table public.samples      enable row level security;
alter table public.sample_log   enable row level security;

create policy "open read"   on public.sample_boxes for select using (true);
create policy "open insert" on public.sample_boxes for insert with check (true);
create policy "open update" on public.sample_boxes for update using (true);
create policy "open delete" on public.sample_boxes for delete using (true);

create policy "open read"   on public.samples for select using (true);
create policy "open insert" on public.samples for insert with check (true);
create policy "open update" on public.samples for update using (true);
create policy "open delete" on public.samples for delete using (true);

create policy "open read"   on public.sample_log for select using (true);
create policy "open insert" on public.sample_log for insert with check (true);

-- realtime
alter publication supabase_realtime add table public.sample_boxes;
alter publication supabase_realtime add table public.samples;
alter publication supabase_realtime add table public.sample_log;
