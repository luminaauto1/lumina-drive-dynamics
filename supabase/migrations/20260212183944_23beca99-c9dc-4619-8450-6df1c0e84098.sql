
-- Add enrichment fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS lead_temperature TEXT DEFAULT 'warm',
ADD COLUMN IF NOT EXISTS trade_in_make_model TEXT,
ADD COLUMN IF NOT EXISTS trade_in_year NUMERIC,
ADD COLUMN IF NOT EXISTS trade_in_mileage NUMERIC,
ADD COLUMN IF NOT EXISTS trade_in_estimated_value NUMERIC,
ADD COLUMN IF NOT EXISTS desired_deposit NUMERIC,
ADD COLUMN IF NOT EXISTS desired_term NUMERIC DEFAULT 72,
ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]'::jsonb;
