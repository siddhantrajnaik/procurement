-- Optional delivery invoices for MB Lab Procurement.
-- Run in the Supabase SQL editor.

alter table public.purchases
  add column invoice_path text,
  add column invoice_name text,
  add column invoice_size bigint check (invoice_size is null or invoice_size >= 0),
  add column invoice_uploaded_by uuid references public.profiles (id) on delete set null,
  add column invoice_uploaded_at timestamptz;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,
  10485760, -- 10 MB; images are compressed client-side before upload
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "invoice files are readable" on storage.objects
  for select to anon, authenticated using (bucket_id = 'invoices');
create policy "invoice files are uploadable" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'invoices');
create policy "invoice files are deletable" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'invoices');
