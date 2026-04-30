-- Recreate public_vehicles view WITHOUT security_invoker so it bypasses
-- the base table's admin-only RLS. The view already excludes sensitive
-- cost/profit columns, so this is safe for public read access.
DROP VIEW IF EXISTS public.public_vehicles;

CREATE VIEW public.public_vehicles
WITH (security_invoker = false) AS
SELECT
  id, make, model, variant, year, mileage, price, fuel_type, transmission,
  color, body_type, images, description, status, finance_available,
  is_featured, is_generic_listing, youtube_url, service_history, fsh_status,
  spare_keys, warranty_expiry_date, service_plan_expiry_date,
  last_service_date, last_service_km, next_service_date, next_service_km,
  variants, sourced_count, created_at, updated_at
FROM public.vehicles;

-- Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.public_vehicles TO anon, authenticated;

-- Direct access to base vehicles table remains admin-only (unchanged).