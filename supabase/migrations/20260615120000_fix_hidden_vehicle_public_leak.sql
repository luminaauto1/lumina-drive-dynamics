-- Privacy fix: a HIDDEN (client-specific) or SOLD vehicle must NEVER be published
-- to the public site, even if is_featured is true. The previous trigger published
-- on `status IN (available,sourcing,incoming) OR is_featured`, so starring a hidden
-- client car leaked that client's specific vehicle onto luminaauto.co.za.
CREATE OR REPLACE FUNCTION public.sync_public_vehicle_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_vehicles WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF (NEW.status = ANY (ARRAY['available'::text, 'sourcing'::text, 'incoming'::text])
       OR NEW.is_featured = true)
     AND NEW.status <> ALL (ARRAY['hidden'::text, 'sold'::text]) THEN
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
$function$;

-- Backfill: remove any currently-leaked hidden/sold vehicles from the public table.
DELETE FROM public.public_vehicles
WHERE id IN (SELECT id FROM public.vehicles WHERE status IN ('hidden','sold'));
