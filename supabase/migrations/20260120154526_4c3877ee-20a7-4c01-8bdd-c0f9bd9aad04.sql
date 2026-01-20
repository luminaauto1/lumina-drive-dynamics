-- Allow Admins to INSERT rows for ANY user_id
DROP POLICY IF EXISTS "Admins can insert any application" ON finance_applications;

CREATE POLICY "Admins can insert any application" 
ON finance_applications 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));