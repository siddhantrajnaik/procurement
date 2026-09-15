-- When an instrument was actually used, as numbers rather than free text.
-- Run in the Supabase SQL editor after previous migrations.
--
-- 0024's `duration` is text ("20 min", "overnight"), which reads fine on a card
-- and cannot be added up: there is no way to answer "how many hours was the
-- incubator busy last month" from it. These two columns can, and together they
-- give the end time as well, so a run that crosses midnight is expressible.
--
-- Both nullable. The visitor's log stays one tap -- a row with neither column
-- filled is still a valid record that someone used the machine. `duration` is
-- kept as-is so the rows already written, and anything typed in free text,
-- survive untouched.

alter table public.equipment_usage_log
  add column started_at       timestamptz,
  add column duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 525600);

-- "What ran on this instrument, most recent first" is the only question asked of
-- these columns, and it is asked per instrument.
create index equipment_usage_log_started_idx
  on public.equipment_usage_log (equipment_id, started_at desc nulls last);
