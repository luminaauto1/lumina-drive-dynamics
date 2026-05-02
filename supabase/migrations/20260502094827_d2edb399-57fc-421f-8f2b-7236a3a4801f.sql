-- Task 2: RLS completion

-- sell_car_requests: allow anonymous + authenticated INSERT (frontend submits via edge fn,
-- but also enable direct submissions as a safety net)
DROP POLICY IF EXISTS "Anyone can submit sell requests" ON public.sell_car_requests;
CREATE POLICY "Anyone can submit sell requests"
ON public.sell_car_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(coalesce(client_name, ''))) > 1
  AND length(trim(coalesce(client_contact, ''))) >= 6
  AND length(trim(coalesce(vehicle_make, ''))) > 0
  AND length(trim(coalesce(vehicle_model, ''))) > 0
);

-- whatsapp_messages: lock down INSERT explicitly to service_role only
DROP POLICY IF EXISTS "Only service role can insert whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Only service role can insert whatsapp messages"
ON public.whatsapp_messages
FOR INSERT
TO service_role
WITH CHECK (true);

-- analytics_events: SELECT already restricted to admins; ensure no broad grant exists
-- (No-op confirmation — existing "Admins can view all analytics" remains.)

-- Task 3: Postgres function privileges
-- Revoke broad EXECUTE rights on internal helpers. Keep service_role + authenticated (for has_role checks via RLS).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lead_status_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_sold_vehicle_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_analytics_event() FROM PUBLIC, anon, authenticated;
