-- Add body_type column to vehicles table
ALTER TABLE public.vehicles
ADD COLUMN body_type text;

-- Add comment for documentation
COMMENT ON COLUMN public.vehicles.body_type IS 'Vehicle body type: Hatchback, Sedan, SUV, Coupe, Convertible, Bakkie/Pickup, MPV';