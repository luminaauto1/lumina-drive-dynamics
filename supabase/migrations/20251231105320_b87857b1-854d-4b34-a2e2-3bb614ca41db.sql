-- Add approved_budget and selected_vehicle_id columns to finance_applications
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS approved_budget NUMERIC;

ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS selected_vehicle_id UUID REFERENCES public.vehicles(id);

-- Add comment for clarity
COMMENT ON COLUMN public.finance_applications.approved_budget IS 'Admin-set maximum approved budget for vehicle purchase';
COMMENT ON COLUMN public.finance_applications.selected_vehicle_id IS 'Vehicle selected by client from curated options';