-- Equipment directory: instruments, their service contacts, and issue tracking.

create table public.equipment (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  model         text not null default '',
  manufacturer  text not null default '',
  category      text not null default 'other',
  location      text not null default '',
  status        text not null default 'working'
                  check (status in ('working','needs_attention','down','under_service')),
  photo_url     text,
  purchase_date date,
  warranty_expiry date,
  service_vendor text not null default '',
  service_contact_person text not null default '',
  service_phone text not null default '',
  notes         text not null default '',
  added_by      uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.equipment_issues (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment(id) on delete cascade,
  reported_by   uuid references public.profiles(id),
  title         text not null,
  description   text not null default '',
  status        text not null default 'reported'
                  check (status in ('reported','investigating','vendor_called','fixed')),
  fix_summary   text not null default '',
  fixed_by      text not null default '',
  fix_cost      numeric(12,2),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create table public.issue_responses (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid not null references public.equipment_issues(id) on delete cascade,
  author_id     uuid references public.profiles(id),
  body          text not null,
  created_at    timestamptz not null default now()
);

create table public.maintenance_logs (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment(id) on delete cascade,
  performed_by  text not null default '',
  description   text not null,
  cost          numeric(12,2),
  service_date  date not null default current_date,
  next_due_date date,
  logged_by     uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- RLS
alter table public.equipment        enable row level security;
alter table public.equipment_issues  enable row level security;
alter table public.issue_responses   enable row level security;
alter table public.maintenance_logs  enable row level security;

create policy "equipment readable"  on public.equipment       for select to anon, authenticated using (true);
create policy "equipment insertable" on public.equipment      for insert to anon, authenticated with check (true);
create policy "equipment updatable"  on public.equipment      for update to anon, authenticated using (true) with check (true);
create policy "equipment deletable"  on public.equipment      for delete to anon, authenticated using (true);

create policy "issues readable"    on public.equipment_issues  for select to anon, authenticated using (true);
create policy "issues insertable"  on public.equipment_issues  for insert to anon, authenticated with check (true);
create policy "issues updatable"   on public.equipment_issues  for update to anon, authenticated using (true) with check (true);
create policy "issues deletable"   on public.equipment_issues  for delete to anon, authenticated using (true);

create policy "responses readable"   on public.issue_responses for select to anon, authenticated using (true);
create policy "responses insertable" on public.issue_responses for insert to anon, authenticated with check (true);

create policy "maint readable"    on public.maintenance_logs   for select to anon, authenticated using (true);
create policy "maint insertable"  on public.maintenance_logs   for insert to anon, authenticated with check (true);
create policy "maint updatable"   on public.maintenance_logs   for update to anon, authenticated using (true) with check (true);

-- Triggers
create trigger equipment_touch_updated_at
  before update on public.equipment
  for each row execute function touch_updated_at();

-- Enable realtime
alter publication supabase_realtime add table public.equipment;
alter publication supabase_realtime add table public.equipment_issues;
alter publication supabase_realtime add table public.issue_responses;
alter publication supabase_realtime add table public.maintenance_logs;
