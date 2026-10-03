-- Public vendor page: opt-in requests, catalogue numbers, vendor sign-ups and offers.
-- The page itself never reads these tables; the vendor-board Edge Function does,
-- with the service role, and returns only what vendors are meant to see.

alter table public.purchases
  add column if not exists catalog_number text check (catalog_number is null or char_length(catalog_number) <= 80),
  add column if not exists vendor_visible boolean not null default false;

create index if not exists purchases_vendor_visible_idx
  on public.purchases (created_at desc) where vendor_visible;

-- ---------------------------------------------------------------- submissions
create table if not exists public.vendor_submissions (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('register', 'offer')),
  name        text not null check (char_length(name) between 1 and 120),
  company     text check (company is null or char_length(company) <= 120),
  phone       text check (phone is null or char_length(phone) <= 40),
  email       text check (email is null or char_length(email) <= 160),
  message     text check (message is null or char_length(message) <= 2000),
  status      text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  created_at  timestamptz not null default now()
);

create index if not exists vendor_submissions_created_idx on public.vendor_submissions (created_at desc);

alter table public.vendor_submissions enable row level security;

-- No insert policy: only the Edge Function (service role) adds rows, so the
-- public key in the app cannot be used to flood this table.
create policy "Anyone can read vendor submissions"
  on public.vendor_submissions for select using (true);
create policy "Anyone can update vendor submissions"
  on public.vendor_submissions for update using (true) with check (true);
create policy "Anyone can delete vendor submissions"
  on public.vendor_submissions for delete using (true);

alter publication supabase_realtime add table public.vendor_submissions;

-- ---------------------------------------------------------------- settings
create table if not exists public.vendor_page_settings (
  id           int primary key default 1 check (id = 1),
  quote_email  text check (quote_email is null or char_length(quote_email) <= 160),
  updated_at   timestamptz not null default now()
);

insert into public.vendor_page_settings (id) values (1) on conflict (id) do nothing;

alter table public.vendor_page_settings enable row level security;

create policy "Anyone can read vendor page settings"
  on public.vendor_page_settings for select using (true);
create policy "Anyone can update vendor page settings"
  on public.vendor_page_settings for update using (true) with check (true);
