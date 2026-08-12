-- Change Sudipto from PI to procurement_incharge
update public.profiles
  set role = 'procurement_incharge'
  where handle = 'sudipto';

-- Allow anon/authenticated to update profiles so role changes can be made from the app
create policy "profiles are updatable" on public.profiles
  for update to anon, authenticated using (true) with check (true);
