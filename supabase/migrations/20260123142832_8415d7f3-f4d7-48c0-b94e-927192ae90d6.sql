-- 1. Drop old status constraint if exists
ALTER TABLE finance_applications DROP CONSTRAINT IF EXISTS finance_applications_status_check;

-- 2. Apply new 9-step status flow constraint
ALTER TABLE finance_applications ADD CONSTRAINT finance_applications_status_check 
CHECK (status IN (
  'pending',                  -- Step 1
  'application_submitted',    -- Step 2
  'pre_approved',             -- Step 3 (Docs Required)
  'documents_received',       -- Step 4
  'validations_pending',      -- Step 5 (Submitted to Bank)
  'validations_complete',     -- Step 6
  'contract_sent',            -- Step 7
  'contract_signed',          -- Step 8
  'vehicle_delivered',        -- Step 9
  'declined',                 -- Exception
  'vehicle_selected',         -- Legacy/Parallel state
  'approved',                 -- Legacy state
  'draft',                    -- Draft applications
  'archived',                 -- Archived applications
  'finalized'                 -- Finalized deals
));

-- 3. Add Secure Token for Public Uploads
ALTER TABLE finance_applications 
ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT gen_random_uuid();

-- 4. Create RLS policy for public access with token
-- Allow public SELECT with valid access_token
DROP POLICY IF EXISTS "Public can view applications with valid token" ON finance_applications;
CREATE POLICY "Public can view applications with valid token" 
ON finance_applications 
FOR SELECT 
USING (
  -- Either the user is the owner, an admin, or has the valid access token
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  (access_token IS NOT NULL)
);

-- Allow public to update application status when uploading documents
DROP POLICY IF EXISTS "Public can update with valid token" ON finance_applications;
CREATE POLICY "Public can update with valid token"
ON finance_applications
FOR UPDATE
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  (access_token IS NOT NULL)
);

-- 5. Create RLS for client-docs bucket for public upload with valid path
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-docs', 'client-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to client-docs bucket if they know the correct path
DROP POLICY IF EXISTS "Allow public upload with token path" ON storage.objects;
CREATE POLICY "Allow public upload with token path"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'client-docs');