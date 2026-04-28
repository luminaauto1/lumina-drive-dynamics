-- Allow anonymous public submissions (ghost account flow may not have a session
-- yet because email confirmation is required). The application is then linked
-- to the user later by admin or by the user once confirmed.
CREATE POLICY "Anonymous can submit applications"
ON public.finance_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL);