-- Let the lab clear log entries.
--
-- 0023 made both tables append-only on the reasoning that a log entry is a
-- statement about a moment. That holds for a real one — but test rows and
-- mistyped names accumulate, and the PI's dashboard is built on these tables,
-- so there has to be a way to take a wrong entry back out.
--
-- Deleting stays a lab-member action in the UI: neither the guest shell nor the
-- PI's screen offers it. As everywhere else here, that is a curtain rather than
-- a wall — the policy is open to anon like every other policy in this schema.

create policy "open delete" on public.equipment_usage_log for delete using (true);
create policy "open delete" on public.consumable_loans    for delete using (true);
