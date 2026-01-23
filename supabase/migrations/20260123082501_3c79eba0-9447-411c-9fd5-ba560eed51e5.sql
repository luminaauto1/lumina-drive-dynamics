-- Add vehicle DNA columns for tracking health and legal status
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS registration_number TEXT,
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_service_date DATE,
ADD COLUMN IF NOT EXISTS last_service_km NUMERIC,
ADD COLUMN IF NOT EXISTS next_service_date DATE,
ADD COLUMN IF NOT EXISTS next_service_km NUMERIC,
ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE,
ADD COLUMN IF NOT EXISTS service_plan_expiry_date DATE,
ADD COLUMN IF NOT EXISTS spare_keys BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fsh_status TEXT DEFAULT 'Full';