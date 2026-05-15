-- Restore the public-safe inventory view so public visitors can see stock
-- without gaining direct access to the full vehicles table.

DROP VIEW IF EXISTS public.public_vehicles;

CREATE VIEW public.public_vehicles
WITH (security_invoker = false) AS
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

-- Keep anonymous users blocked from the full vehicle table.
REVOKE ALL ON TABLE public.vehicles FROM anon;