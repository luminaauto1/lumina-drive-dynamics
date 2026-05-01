
-- Helper: is this user any staff member (admin OR sales_agent)?
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'sales_agent'::app_role)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- LEADS: sales agents can view and update (no delete)
CREATE POLICY "Sales agents can view all leads"
ON public.leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY "Sales agents can update leads"
ON public.leads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'sales_agent'::app_role));

-- FINANCE_APPLICATIONS: sales agents can view and update (no delete)
CREATE POLICY "Sales agents can view all finance applications"
ON public.finance_applications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY "Sales agents can update finance applications"
ON public.finance_applications FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'sales_agent'::app_role));

-- VEHICLES: read-only for sales agents
CREATE POLICY "Sales agents can view vehicles"
ON public.vehicles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role));

-- LEAD_NOTES: read + insert
CREATE POLICY "Sales agents can view lead notes"
ON public.lead_notes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY "Sales agents can insert lead notes"
ON public.lead_notes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'sales_agent'::app_role));

-- CLIENT_AUDIT_LOGS: full manage for staff workflows
CREATE POLICY "Sales agents can manage audit logs"
ON public.client_audit_logs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'sales_agent'::app_role));

-- FINANCE_OFFERS, APPLICATION_MATCHES, PROFILES: read
CREATE POLICY "Sales agents can view finance offers"
ON public.finance_offers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY "Sales agents can view application matches"
ON public.application_matches FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY "Sales agents can view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sales_agent'::app_role));
