-- ============================================================
-- 003_additions.sql
-- Add preferred_rest_days to employees
-- Add days_of_week to service_requirements
-- ============================================================

-- Preferred rest days per employee (0=Sun, 1=Mon, ..., 6=Sat)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS preferred_rest_days smallint[] DEFAULT '{}';

-- Per-day-of-week staffing requirements
-- NULL or empty array = applies to all days (legacy behavior)
ALTER TABLE service_requirements
  ADD COLUMN IF NOT EXISTS days_of_week smallint[] DEFAULT '{0,1,2,3,4,5,6}';
