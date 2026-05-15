-- Replace the public inventory view with a real public-safe listing table.
-- This avoids security-definer views while preserving public stock visibility.

DROP VIEW IF EXISTS public.public_vehicles;

CREATE TABLE IF NOT EXISTS public.public_vehicles (
  id uuid PRIMARY KEY,
  make text NOT NULL,
  model text NOT NULL,
  variant text,
  year integer NOT NULL,
  mileage integer NOT NULL,
  price integer NOT NULL,
  fuel_type text NOT NULL,
  transmission text NOT NULL,
  color text,
  body_type text,
  images text[],
  description text,
  status text NOT NULL,
  finance_available boolean,
  is_featured boolean,
  is_generic_listing boolean,
  youtube_url text,
  service_history text,
  fsh_status text,
  spare_keys boolean,
  warranty_expiry_date date,
  service_plan_expiry_date date,
  last_service_date date,
  last_service_km numeric,
  next_service_date date,
  next_service_km numeric,
  variants jsonb,
  sourced_count integer,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.public_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view public vehicle listings" ON public.public_vehicles;
CREATE POLICY "Public can view public vehicle listings"
ON public.public_vehicles
FOR SELECT
TO anon, authenticated
USING (true);

-- No public write policies are created; this table is maintained by trigger only.
GRANT SELECT ON TABLE public.public_vehicles TO anon, authenticated;

-- Populate safe listings from listable vehicles only.
INSERT INTO public.public_vehicles (
  id, make, model, variant, year, mileage, price, fuel_type, transmission,
  color, body_type, images, description, status, finance_available,
  is_featured, is_generic_listing, youtube_url, service_history, fsh_status,
  spare_keys, warranty_expiry_date, service_plan_expiry_date,
  last_service_date, last_service_km, next_service_date, next_service_km,
  variants, sourced_count, created_at, updated_at
)
SELECT
  id, make, model, variant, year, mileage, price, fuel_type, transmission,
  color, body_type, images, description, status, finance_available,
  is_featured, is_generic_listing, youtube_url, service_history, fsh_status,
  spare_keys, warranty_expiry_date, service_plan_expiry_date,
  last_service_date, last_service_km, next_service_date, next_service_km,
  variants, sourced_count, created_at, updated_at
FROM public.vehicles
WHERE
  status = ANY (ARRAY['available'::text, 'sourcing'::text, 'incoming'::text])
  OR is_featured = true
ON CONFLICT (id) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  variant = EXCLUDED.variant,
  year = EXCLUDED.year,
  mileage = EXCLUDED.mileage,
  price = EXCLUDED.price,
  fuel_type = EXCLUDED.fuel_type,
  transmission = EXCLUDED.transmission,
  color = EXCLUDED.color,
  body_type = EXCLUDED.body_type,
  images = EXCLUDED.images,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  finance_available = EXCLUDED.finance_available,
  is_featured = EXCLUDED.is_featured,
  is_generic_listing = EXCLUDED.is_generic_listing,
  youtube_url = EXCLUDED.youtube_url,
  service_history = EXCLUDED.service_history,
  fsh_status = EXCLUDED.fsh_status,
  spare_keys = EXCLUDED.spare_keys,
  warranty_expiry_date = EXCLUDED.warranty_expiry_date,
  service_plan_expiry_date = EXCLUDED.service_plan_expiry_date,
  last_service_date = EXCLUDED.last_service_date,
  last_service_km = EXCLUDED.last_service_km,
  next_service_date = EXCLUDED.next_service_date,
  next_service_km = EXCLUDED.next_service_km,
  variants = EXCLUDED.variants,
  sourced_count = EXCLUDED.sourced_count,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

DELETE FROM public.public_vehicles pv
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vehicles v
  WHERE v.id = pv.id
    AND (
      v.status = ANY (ARRAY['available'::text, 'sourcing'::text, 'incoming'::text])
      OR v.is_featured = true
    )
);

CREATE OR REPLACE FUNCTION public.sync_public_vehicle_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_vehicles WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status = ANY (ARRAY['available'::text, 'sourcing'::text, 'incoming'::text])
     OR NEW.is_featured = true THEN
    INSERT INTO public.public_vehicles (
      id, make, model, variant, year, mileage, price, fuel_type, transmission,
      color, body_type, images, description, status, finance_available,
      is_featured, is_generic_listing, youtube_url, service_history, fsh_status,
      spare_keys, warranty_expiry_date, service_plan_expiry_date,
      last_service_date, last_service_km, next_service_date, next_service_km,
      variants, sourced_count, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.make, NEW.model, NEW.variant, NEW.year, NEW.mileage, NEW.price, NEW.fuel_type, NEW.transmission,
      NEW.color, NEW.body_type, NEW.images, NEW.description, NEW.status, NEW.finance_available,
      NEW.is_featured, NEW.is_generic_listing, NEW.youtube_url, NEW.service_history, NEW.fsh_status,
      NEW.spare_keys, NEW.warranty_expiry_date, NEW.service_plan_expiry_date,
      NEW.last_service_date, NEW.last_service_km, NEW.next_service_date, NEW.next_service_km,
      NEW.variants, NEW.sourced_count, NEW.created_at, NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      make = EXCLUDED.make,
      model = EXCLUDED.model,
      variant = EXCLUDED.variant,
      year = EXCLUDED.year,
      mileage = EXCLUDED.mileage,
      price = EXCLUDED.price,
      fuel_type = EXCLUDED.fuel_type,
      transmission = EXCLUDED.transmission,
      color = EXCLUDED.color,
      body_type = EXCLUDED.body_type,
      images = EXCLUDED.images,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      finance_available = EXCLUDED.finance_available,
      is_featured = EXCLUDED.is_featured,
      is_generic_listing = EXCLUDED.is_generic_listing,
      youtube_url = EXCLUDED.youtube_url,
      service_history = EXCLUDED.service_history,
      fsh_status = EXCLUDED.fsh_status,
      spare_keys = EXCLUDED.spare_keys,
      warranty_expiry_date = EXCLUDED.warranty_expiry_date,
      service_plan_expiry_date = EXCLUDED.service_plan_expiry_date,
      last_service_date = EXCLUDED.last_service_date,
      last_service_km = EXCLUDED.last_service_km,
      next_service_date = EXCLUDED.next_service_date,
      next_service_km = EXCLUDED.next_service_km,
      variants = EXCLUDED.variants,
      sourced_count = EXCLUDED.sourced_count,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at;
  ELSE
    DELETE FROM public.public_vehicles WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_public_vehicle_listing() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_public_vehicle_listing_trigger ON public.vehicles;
CREATE TRIGGER sync_public_vehicle_listing_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_vehicle_listing();

-- Keep anonymous visitors blocked from the full vehicle table.
REVOKE ALL ON TABLE public.vehicles FROM anon;

-- Do not allow non-admin public listable policies on the full vehicles table.
DROP POLICY IF EXISTS "Public can view listable vehicles" ON public.vehicles;