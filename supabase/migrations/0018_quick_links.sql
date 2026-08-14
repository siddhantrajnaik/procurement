create table if not exists public.quick_links (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  url        text not null,
  added_by   uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.quick_links enable row level security;

create policy "Anyone can read quick_links"
  on public.quick_links for select using (true);

create policy "Authenticated can insert quick_links"
  on public.quick_links for insert with check (true);

create policy "Anyone can delete quick_links"
  on public.quick_links for delete using (true);
