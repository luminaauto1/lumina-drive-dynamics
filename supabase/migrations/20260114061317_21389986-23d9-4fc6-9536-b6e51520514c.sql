-- 1. ADD VARIANTS TO VEHICLES
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- 2. CREATE SALES REPS SETTINGS
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS sales_reps JSONB DEFAULT '[]'::jsonb;

-- 3. CREATE DEAL RECORDS TABLE
CREATE TABLE IF NOT EXISTS deal_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES finance_applications(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  sales_rep_name TEXT,
  sales_rep_commission NUMERIC,
  sold_price NUMERIC,
  sold_mileage INTEGER,
  next_service_date DATE,
  next_service_km INTEGER,
  delivery_address TEXT,
  delivery_date TIMESTAMP WITH TIME ZONE,
  aftersales_expenses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE deal_records ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all deal records" 
ON deal_records 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert deal records" 
ON deal_records 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update deal records" 
ON deal_records 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete deal records" 
ON deal_records 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));