
-- 1. Add Trustpilot URL to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS trustpilot_url TEXT;

-- 2. Fix deal_records SELECT for public handover page
-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Admins can view all deal records" ON deal_records;
-- Recreate as PERMISSIVE for admins
CREATE POLICY "Admins can view all deal records" ON deal_records FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
-- Add public read for handover page
CREATE POLICY "Public can view deal records" ON deal_records FOR SELECT TO anon USING (true);

-- 3. Fix finance_applications SELECT for public handover page
DROP POLICY IF EXISTS "Admins can view all applications" ON finance_applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON finance_applications;
-- Recreate as PERMISSIVE
CREATE POLICY "Admins can view all applications" ON finance_applications FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own applications" ON finance_applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Add public read for handover page (only anon role)
CREATE POLICY "Public can view applications" ON finance_applications FOR SELECT TO anon USING (true);
