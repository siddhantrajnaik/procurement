-- Add guest to the user_role enum
alter type user_role add value 'guest';

-- Add guest user
insert into public.profiles (id, handle, name, role, email, department, accent) values
  ('a1000000-0000-4000-8000-000000000099', 'guest', 'Guest', 'guest', null, null, 'slate')
on conflict (id) do nothing;
