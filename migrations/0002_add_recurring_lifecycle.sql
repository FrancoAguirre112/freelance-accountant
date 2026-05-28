-- Adds business-meaning lifecycle dates to recurring services.
--
-- start_date: when the recurrence begins (NOT NULL).
-- end_date:   when it ends; NULL = still ongoing.
--
-- Existing rows are backfilled to 2026-01-01T12:00:00Z (the user-specified
-- default for "we don't know the exact start"). Adjust any individual row
-- afterwards via update_recurring.

ALTER TABLE recurring_services
  ADD COLUMN start_date INTEGER NOT NULL DEFAULT 1767268800;
ALTER TABLE recurring_services
  ADD COLUMN end_date INTEGER;
