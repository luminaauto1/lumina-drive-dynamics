-- Lock down direct public access to the full vehicles table while preserving
-- safe public inventory reads through public.public_vehicles.

REVOKE ALL ON TABLE public.vehicles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicles TO authenticated;

-- Remove any broad public vehicle policy and replace it with a safe,
-- listable-only policy for the public inventory view to evaluate via RLS.
DROP POLICY IF EXISTS "Public can view listable vehicles" ON public.vehicles;

CREATE POLICY "Public can view listable vehicles"
ON public.vehicles
FOR SELECT
TO anon, authenticated
USING (
  status = ANY (ARRAY['available'::text, 'sourcing'::text, 'incoming'::text])
  OR is_featured = true
);

-- Recreate the public-safe inventory view with only display-safe columns.
-- security_invoker keeps RLS active, and the view's column list prevents
-- public exposure of internal financial/vehicle-identification fields.
DROP VIEW IF EXISTS public.public_vehicles;

CREATE VIEW public.public_vehicles
WITH (security_invoker = true) AS
SELECT
  id,
  make,
  model,
  variant,
  year,
  mileage,
  price,
  fuel_type,
  transmission,
  color,
  body_type,
  images,
  description,
  status,
  finance_available,
  is_featured,
  is_generic_listing,
  youtube_url,
  service_history,
  fsh_status,
  spare_keys,
  warranty_expiry_date,
  service_plan_expiry_date,
  last_service_date,
  last_service_km,
  next_service_date,
  next_service_km,
  variants,
  sourced_count,
  created_at,
  updated_at
FROM public.vehicles
WHERE
  status = ANY (ARRAY['available'::text, 'sourcing'::text, 'incoming'::text])
  OR is_featured = true;

GRANT SELECT ON TABLE public.public_vehicles TO anon, authenticated;