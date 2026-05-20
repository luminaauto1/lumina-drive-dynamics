-- Allow staff (admins, sales agents, F&I) to insert finance_applications
-- on behalf of clients, where user_id may belong to another profile or be
-- the shadow placeholder. The existing "Anyone can submit applications"
-- policy (which restricts user_id to auth.uid() or null) remains in place
-- for self-service submissions.

DROP POLICY IF EXISTS "Staff can insert applications on behalf of clients" ON public.finance_applications;

CREATE POLICY "Staff can insert applications on behalf of clients"
ON public.finance_applications
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sales_agent'::app_role)
  OR public.has_role(auth.uid(), 'f_and_i'::app_role)
  OR public.has_role(auth.uid(), 'senior_f_and_i'::app_role)
);