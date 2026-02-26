
-- CRITICAL: Remove public access to deal_records (exposes commissions, profits, partner splits, cost prices)
DROP POLICY IF EXISTS "Public can view deal records" ON public.deal_records;

-- Remove overly permissive email template access (internal templates visible to all authenticated users)
DROP POLICY IF EXISTS "Authenticated users can read email templates" ON public.email_templates;

-- Replace with admin-only read for email templates
CREATE POLICY "Admins can view email templates"
ON public.email_templates
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
