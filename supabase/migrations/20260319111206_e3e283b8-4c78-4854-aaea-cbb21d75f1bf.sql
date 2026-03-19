CREATE POLICY "Users can update own revision applications"
ON public.finance_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'needs_revision')
WITH CHECK (auth.uid() = user_id);