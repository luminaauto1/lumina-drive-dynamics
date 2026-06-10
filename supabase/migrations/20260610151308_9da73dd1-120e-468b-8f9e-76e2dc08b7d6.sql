-- Drop the overly-permissive anon SELECT policy on site_settings.
-- Public site reads safe fields via the public_site_settings view (security_invoker=on).
DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;

-- Revoke any leftover direct anon grants on the base table; keep view grants intact.
REVOKE SELECT ON public.site_settings FROM anon;