-- A line of text for the lab's wall screen (group meeting, closure, visitors...), with an optional last day.
-- Lives on the same single settings row as the vendor page. The wall screen reads it through its own function.
alter table public.vendor_page_settings
  add column if not exists wall_notice       text check (wall_notice is null or char_length(wall_notice) <= 140),
  add column if not exists wall_notice_until date;
