
-- 1. Create a public-safe view for vehicles (excludes sensitive financial/internal columns)
CREATE OR REPLACE VIEW public.public_vehicles AS
SELECT
  id, make, model, variant, year, mileage, price, fuel_type, transmission,
  color, body_type, images, description, status, finance_available,
  is_featured, is_generic_listing, youtube_url, service_history,
  fsh_status, spare_keys, warranty_expiry_date, service_plan_expiry_date,
  last_service_date, last_service_km, next_service_date, next_service_km,
  variants, sourced_count, created_at, updated_at
FROM public.vehicles;

-- Grant access to the view for anon and authenticated roles
GRANT SELECT ON public.public_vehicles TO anon, authenticated;

-- 2. Remove leads and vehicles from Realtime publication (safe: DROP ignores if not present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.leads;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicles'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.vehicles;
  END IF;
END $$;

-- 3. Remove any anonymous upload policy on client-docs storage bucket
DROP POLICY IF EXISTS "Allow token-based public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous uploads to client-docs" ON storage.objects;
