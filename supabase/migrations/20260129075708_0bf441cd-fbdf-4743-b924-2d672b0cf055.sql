-- Drop the foreign key constraint that references auth.users
-- This allows admin-created applications to use shadow user IDs
ALTER TABLE finance_applications 
DROP CONSTRAINT IF EXISTS finance_applications_user_id_fkey;

-- Also ensure the admin INSERT policy uses the correct has_role function
DROP POLICY IF EXISTS "Admins can insert any application" ON finance_applications;
CREATE POLICY "Admins can insert any application" 
ON finance_applications 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));