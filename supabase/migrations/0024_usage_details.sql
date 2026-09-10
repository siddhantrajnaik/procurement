-- Optional detail on an instrument usage entry: what it was for, how fast it
-- was run, and how long. Run in the Supabase SQL editor after 0023.

-- All three stay free text and default to empty. A visitor logging use in one
-- tap fills in none of them, and "about 20 min" or "12k rpm" is the shape real
-- answers take -- nothing does arithmetic on these.
alter table public.equipment_usage_log
  add column speed    text not null default '',
  add column duration text not null default '';
