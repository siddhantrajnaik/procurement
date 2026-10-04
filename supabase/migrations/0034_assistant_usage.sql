-- Daily request counter for the assistant's Gemini function.
-- The app has no real login, so this cap is what stops anyone with the link
-- from using up the lab's free Gemini quota. Only the Edge Function (service
-- role) can touch it: RLS is on with no policies, and the bump function is
-- granted to service_role alone.

create table if not exists public.assistant_usage (
  day    date primary key,
  count  int  not null default 0
);

alter table public.assistant_usage enable row level security;

create or replace function public.bump_assistant_usage()
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.assistant_usage (day, count)
  values ((now() at time zone 'Asia/Kolkata')::date, 1)
  on conflict (day) do update set count = public.assistant_usage.count + 1
  returning count;
$$;

revoke all on function public.bump_assistant_usage() from public, anon, authenticated;
grant execute on function public.bump_assistant_usage() to service_role;
