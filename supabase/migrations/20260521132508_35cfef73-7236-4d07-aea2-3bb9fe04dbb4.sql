CREATE POLICY "Accountants can view deal records"
ON public.deal_records
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can view vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can view finance applications"
ON public.finance_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update finance applications"
ON public.finance_applications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role))
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
