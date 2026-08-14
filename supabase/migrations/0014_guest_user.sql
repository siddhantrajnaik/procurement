-- Add guest role to profiles check constraint
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('lab_member', 'procurement_incharge', 'pi', 'guest'));

-- Add guest user
insert into public.profiles (id, handle, name, role, email, department, accent) values
  ('a1000000-0000-4000-8000-000000000099', 'guest', 'Guest', 'guest', null, null, 'slate')
on conflict (id) do nothing;
