-- 1. Internal Status for Granular Tracking
ALTER TABLE finance_applications 
ADD COLUMN IF NOT EXISTS internal_status TEXT DEFAULT 'new_lead';

-- 2. Delivery Checklist Table
CREATE TABLE IF NOT EXISTS delivery_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES finance_applications(id) ON DELETE CASCADE NOT NULL,
  task_name TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Vehicle Linking (Vice Versa)
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS reserved_for_application_id UUID REFERENCES finance_applications(id);

-- 4. Enable RLS on delivery_tasks
ALTER TABLE delivery_tasks ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for delivery_tasks using has_role function
CREATE POLICY "Admins can manage delivery tasks" 
ON delivery_tasks 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Index for faster vehicle reservation lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_reserved_for_application 
ON vehicles(reserved_for_application_id) 
WHERE reserved_for_application_id IS NOT NULL;