-- Make all lab members procurement_incharge
update public.profiles set role = 'procurement_incharge' where role = 'lab_member';
