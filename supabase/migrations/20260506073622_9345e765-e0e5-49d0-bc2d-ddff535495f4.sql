
CREATE POLICY "F&I can update finance applications"
ON public.finance_applications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'f_and_i'::app_role))
WITH CHECK (has_role(auth.uid(), 'f_and_i'::app_role));

CREATE POLICY "F&I can view finance applications"
ON public.finance_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'f_and_i'::app_role));

CREATE POLICY "F&I can manage audit logs"
ON public.client_audit_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'f_and_i'::app_role))
WITH CHECK (has_role(auth.uid(), 'f_and_i'::app_role));
