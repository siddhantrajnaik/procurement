-- The PI: read-only spend and lab-activity view, reached by her own link.
-- The 'pi' value already exists in the user_role enum from 0001, so no alter type.
insert into public.profiles (id, handle, name, role, email, department, accent) values
  ('a1000000-0000-4000-8000-000000000098', 'manidipa', 'Prof. Manidipa Banerjee',
   'pi', null, 'Structural Virology Lab', 'indigo')
on conflict (id) do nothing;
