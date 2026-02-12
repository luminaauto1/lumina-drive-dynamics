
-- 1. Add Archive & Tracking to Leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS admin_last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Trigger: Update 'status_updated_at' on any change
CREATE OR REPLACE FUNCTION public.update_lead_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.status_updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_lead_status_timestamp_trigger
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_status_timestamp();
