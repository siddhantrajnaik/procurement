-- Optional, short-lived photos on requests shown to vendors, plus a lab
-- WhatsApp number for quotes. Photo files are deleted through the Storage API
-- (by the vendor-board function and by the app); SQL here only adds the
-- columns, the private bucket, and the nightly trigger for the cleanup.

alter table public.purchases
  add column if not exists vendor_photo_path text,
  add column if not exists vendor_photo_at timestamptz;

alter table public.vendor_page_settings
  add column if not exists whatsapp_number text
    check (whatsapp_number is null or char_length(whatsapp_number) <= 20);

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-photos',
  'vendor-photos',
  false,
  2097152, -- 2 MB; photos are compressed to ~300 KB in the app before upload
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- The vendor page never uses these: it gets signed URLs from the Edge Function.
-- They let lab members upload, preview and remove their own request's photo.
drop policy if exists "vendor photos are readable" on storage.objects;
drop policy if exists "vendor photos are uploadable" on storage.objects;
drop policy if exists "vendor photos are deletable" on storage.objects;

create policy "vendor photos are readable" on storage.objects
  for select to anon, authenticated using (bucket_id = 'vendor-photos');
create policy "vendor photos are uploadable" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'vendor-photos');
create policy "vendor photos are deletable" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'vendor-photos');

-- ---------------------------------------------------------------- nightly cleanup
-- 21:30 UTC = 03:00 IST. Calls the Edge Function, which does the deleting.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('vendor-photo-cleanup');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule(
  'vendor-photo-cleanup',
  '30 21 * * *',
  $cron$ select net.http_get('https://myronxrjtygolgnfrpkl.supabase.co/functions/v1/vendor-board?cleanup=1') $cron$
);
