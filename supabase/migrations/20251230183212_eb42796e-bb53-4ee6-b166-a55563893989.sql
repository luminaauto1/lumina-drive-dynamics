-- Add preferred_vehicle_text column to finance_applications
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS preferred_vehicle_text TEXT;

-- Add is_generic_listing column to vehicles
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS is_generic_listing BOOLEAN DEFAULT false;