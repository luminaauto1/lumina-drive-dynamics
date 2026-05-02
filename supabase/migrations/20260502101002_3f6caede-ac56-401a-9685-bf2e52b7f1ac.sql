-- TASK 1: Restrict finance_banks SELECT to staff only (signing URLs are sensitive)
DROP POLICY IF EXISTS "Everyone can read banks" ON public.finance_banks;

CREATE POLICY "Staff can read banks"
ON public.finance_banks
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- TASK 3: Lock down SECURITY DEFINER functions — revoke from authenticated/anon/PUBLIC,
-- grant only to roles that legitimately need to execute them.

-- has_role: used inside RLS policies (which evaluate as the calling role).
-- Keep accessible to authenticated so RLS can call it; revoke from anon/PUBLIC.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- is_staff: same reasoning as has_role (used in RLS policies).
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- handle_new_user: trigger function on auth.users — only the trigger context needs it.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Trigger-only helpers — no role should call these directly.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_lead_status_timestamp() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_lead_status_timestamp() TO service_role;

REVOKE EXECUTE ON FUNCTION public.prevent_sold_vehicle_deletion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_sold_vehicle_deletion() TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_analytics_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_analytics_event() TO service_role;