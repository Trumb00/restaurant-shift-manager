-- ============================================================
-- 004: Auto-link auth users to employee records by email
-- ============================================================
-- Run this in the Supabase SQL Editor.
--
-- PROBLEM: employee rows are created by admins with user_id = NULL.
-- When an employee logs in via magic link for the first time, Supabase
-- creates an auth.users entry but the employees table has no matching
-- user_id, so RLS-protected queries return nothing.
--
-- SOLUTION:
--   1. One-time backfill: link any auth users already in the system
--      to employee records that share the same email.
--   2. Trigger: whenever a new auth user is created (magic link /
--      invite), automatically set user_id on the matching employee row.
-- ============================================================

-- 1. One-time backfill for existing auth users
UPDATE public.employees e
SET    user_id    = au.id,
       updated_at = NOW()
FROM   auth.users au
WHERE  lower(e.email) = lower(au.email)
  AND  e.user_id IS NULL;

-- 2. Trigger function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.link_employee_on_auth_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employees
  SET    user_id    = NEW.id,
         updated_at = NOW()
  WHERE  lower(email) = lower(NEW.email)
    AND  user_id IS NULL;
  RETURN NEW;
END;
$$;

-- 3. Trigger on auth.users INSERT (fires on first magic-link / invite login)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_employee_on_auth_signup();
