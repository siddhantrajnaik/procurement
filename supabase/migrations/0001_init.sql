-- MB Lab Procurement — initial schema
-- Run in the Supabase SQL editor, or `supabase db push` with the CLI.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- types

create type public.user_role as enum ('lab_member', 'procurement_incharge', 'pi');
create type public.purchase_status as enum ('waiting', 'quotes', 'ordered', 'transit', 'delivered', 'closed');
create type public.urgency_level as enum ('low', 'normal', 'urgent', 'critical');
create type public.activity_type as enum ('created', 'quote_added', 'status_changed', 'comment_added', 'pi_approved', 'assigned');

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id         uuid primary key default gen_random_uuid(),
  handle     text unique not null,
  name       text not null,
  role       public.user_role not null default 'lab_member',
  email      text,
  department text,
  -- Colour token, not a CSS class: the client owns presentation.
  accent     text not null default 'slate',
  created_at timestamptz not null default now()
);

create table public.purchases (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null check (char_length(trim(title)) between 1 and 120),
  description          text not null default '',
  quantity             text not null default '',
  category             text not null default 'General',
  priority             public.urgency_level not null default 'normal',
  status               public.purchase_status not null default 'waiting',
  preferred_company    text,
  requested_by         uuid not null references public.profiles (id) on delete restrict,
  assigned_to          uuid references public.profiles (id) on delete set null,
  requires_pi_approval boolean not null default false,
  pi_approved          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.quotations (
  id             uuid primary key default gen_random_uuid(),
  purchase_id    uuid not null references public.purchases (id) on delete cascade,
  vendor         text not null check (char_length(trim(vendor)) between 1 and 120),
  price          numeric(12, 2) not null check (price >= 0),
  currency       text not null default 'INR',
  notes          text,
  -- Object path inside the `quotations` storage bucket; null when no file was attached.
  file_path      text,
  file_name      text,
  file_size      bigint check (file_size is null or file_size >= 0),
  is_approved    boolean not null default false,
  is_recommended boolean not null default false,
  uploaded_by    uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(trim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create table public.activities (
  id             uuid primary key default gen_random_uuid(),
  purchase_id    uuid references public.purchases (id) on delete cascade,
  purchase_title text not null,
  actor_id       uuid references public.profiles (id) on delete set null,
  type           public.activity_type not null,
  details        text not null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes

create index purchases_created_at_idx on public.purchases (created_at desc);
create index purchases_status_idx     on public.purchases (status);
create index quotations_purchase_idx  on public.quotations (purchase_id, created_at desc);
create index comments_purchase_idx    on public.comments (purchase_id, created_at);
create index activities_created_idx   on public.activities (created_at desc);

-- At most one quotation per purchase can be the selected PO.
create unique index quotations_one_approved_per_purchase
  on public.quotations (purchase_id)
  where is_approved;

-- ---------------------------------------------------------------- triggers

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger purchases_touch_updated_at
  before update on public.purchases
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- admin PIN
-- The PIN never reaches the browser bundle. `app_config` has RLS enabled and no
-- policies, so the anon key cannot read it; only this security-definer function can.

create table public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;

insert into public.app_config (key, value)
values ('admin_pin_hash', extensions.crypt('8249', extensions.gen_salt('bf')))
on conflict (key) do nothing;

create or replace function public.verify_admin_pin(pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored text;
begin
  select value into stored from public.app_config where key = 'admin_pin_hash';
  if stored is null then
    return false;
  end if;
  return stored = extensions.crypt(pin, stored);
end;
$$;

revoke all on function public.verify_admin_pin(text) from public;
grant execute on function public.verify_admin_pin(text) to anon, authenticated;

-- To change the PIN later:
--   update public.app_config
--      set value = extensions.crypt('1234', extensions.gen_salt('bf'))
--    where key = 'admin_pin_hash';

-- ---------------------------------------------------------------- row level security
--
-- SECURITY MODEL: this app has no per-user login — everyone shares the anon key and
-- picks their name from a list. So the policies below are deliberately open to the
-- `anon` role: anyone who has the site URL can read and write lab procurement data.
-- That is an accepted trade-off for a private 9-person lab tool, NOT a secure setup.
-- To harden it, switch to Supabase Auth and replace `to anon` with `to authenticated`
-- plus `auth.uid()` ownership checks. See the README.

alter table public.profiles   enable row level security;
alter table public.purchases  enable row level security;
alter table public.quotations enable row level security;
alter table public.comments   enable row level security;
alter table public.activities enable row level security;

-- Profiles are reference data, seeded below. Readable by all, writable by nobody
-- holding the anon key (edit them in the dashboard or via a service-role key).
create policy "profiles are readable" on public.profiles
  for select to anon, authenticated using (true);

create policy "purchases are readable" on public.purchases
  for select to anon, authenticated using (true);
create policy "purchases are insertable" on public.purchases
  for insert to anon, authenticated with check (true);
create policy "purchases are updatable" on public.purchases
  for update to anon, authenticated using (true) with check (true);
create policy "purchases are deletable" on public.purchases
  for delete to anon, authenticated using (true);

create policy "quotations are readable" on public.quotations
  for select to anon, authenticated using (true);
create policy "quotations are insertable" on public.quotations
  for insert to anon, authenticated with check (true);
create policy "quotations are updatable" on public.quotations
  for update to anon, authenticated using (true) with check (true);
create policy "quotations are deletable" on public.quotations
  for delete to anon, authenticated using (true);

create policy "comments are readable" on public.comments
  for select to anon, authenticated using (true);
create policy "comments are insertable" on public.comments
  for insert to anon, authenticated with check (true);

create policy "activities are readable" on public.activities
  for select to anon, authenticated using (true);
create policy "activities are insertable" on public.activities
  for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quotations',
  'quotations',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "quotation files are readable" on storage.objects
  for select to anon, authenticated using (bucket_id = 'quotations');
create policy "quotation files are uploadable" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'quotations');
create policy "quotation files are deletable" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'quotations');

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table public.purchases;
alter publication supabase_realtime add table public.quotations;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.activities;

-- ---------------------------------------------------------------- seed: lab members

insert into public.profiles (id, handle, name, role, email, department, accent) values
  ('a1000000-0000-4000-8000-000000000001', 'paulomi',  'Paulomi Goswami',   'lab_member',            'blz208816@bioschool.iitd.ac.in', 'Structural Biology Lab', 'purple'),
  ('a1000000-0000-4000-8000-000000000002', 'milan',    'Milan K. Lokshman', 'lab_member',            'blz218474@bioschool.iitd.ac.in', 'Structural Biology Lab', 'blue'),
  ('a1000000-0000-4000-8000-000000000003', 'mrittika', 'Mrittika Dasgupta', 'lab_member',            'blz228266@bioschool.iitd.ac.in', 'Structural Biology Lab', 'emerald'),
  ('a1000000-0000-4000-8000-000000000004', 'rupam',    'Rupam Khatua',      'procurement_incharge',  'blz228500@bioschool.iitd.ac.in', 'Structural Biology Lab', 'indigo'),
  ('a1000000-0000-4000-8000-000000000005', 'bhawna',   'Bhawna',            'lab_member',            'srz238552@sire.iitd.ac.in',      'Structural Biology Lab', 'pink'),
  ('a1000000-0000-4000-8000-000000000006', 'himanshu', 'Himanshu',          'procurement_incharge',  'blz238595@bioschool.iitd.ac.in', 'Structural Biology Lab', 'orange'),
  ('a1000000-0000-4000-8000-000000000007', 'komal',    'Komal Arora',       'lab_member',            'srz238555@sire.iitd.ac.in',      'Structural Biology Lab', 'cyan'),
  ('a1000000-0000-4000-8000-000000000008', 'siddhant', 'Siddhant Raj Naik', 'procurement_incharge',  'blz258027@bioschool.iitd.ac.in', 'Structural Biology Lab', 'amber'),
  ('a1000000-0000-4000-8000-000000000009', 'sudipto',  'Sudipto Chaki',     'procurement_incharge',  'blz258030@bioschool.iitd.ac.in', 'Structural Biology Lab', 'red'),
  ('a1000000-0000-4000-8000-000000000010', 'nalini',   'Nalini',            'lab_member',            null,                             'Structural Biology Lab', 'slate'),
  ('a1000000-0000-4000-8000-000000000011', 'shalini',  'Shalini',           'lab_member',            null,                             'Structural Biology Lab', 'emerald'),
  ('a1000000-0000-4000-8000-000000000012', 'jha',      'Jha Sir',           'procurement_incharge',  null,                             'Structural Biology Lab', 'indigo')
on conflict (handle) do nothing;
