-- Allow sales_agent role to INSERT and UPDATE vehicles (no DELETE)
CREATE POLICY "Sales agents can insert vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY "Sales agents can update vehicles"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'sales_agent'::app_role))
WITH CHECK (has_role(auth.uid(), 'sales_agent'::app_role));