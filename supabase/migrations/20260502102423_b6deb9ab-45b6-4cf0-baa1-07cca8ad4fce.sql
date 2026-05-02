-- Revoke EXECUTE from authenticated on trigger-only SECURITY DEFINER functions.
-- has_role and is_staff remain executable by authenticated because RLS policies
-- reference them and require EXECUTE rights on the calling role.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lead_status_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_sold_vehicle_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_analytics_event() FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains execution (triggers run with table owner privileges,
-- but explicit grant prevents accidental lockout for direct service-role invocation).
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_lead_status_timestamp() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_sold_vehicle_deletion() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_analytics_event() TO service_role;