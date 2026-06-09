CREATE POLICY "Staff manage credit-check screenshots"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'credit-check-screenshots'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sales_agent'::app_role)
    OR public.has_role(auth.uid(), 'f_and_i'::app_role)
    OR public.has_role(auth.uid(), 'senior_f_and_i'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'credit-check-screenshots'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sales_agent'::app_role)
    OR public.has_role(auth.uid(), 'f_and_i'::app_role)
    OR public.has_role(auth.uid(), 'senior_f_and_i'::app_role)
  )
);