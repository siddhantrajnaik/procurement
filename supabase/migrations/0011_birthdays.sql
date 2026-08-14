-- Add birthday column to profiles (date only, no year required — stores MM-DD or full date)
alter table public.profiles add column if not exists birthday date;
