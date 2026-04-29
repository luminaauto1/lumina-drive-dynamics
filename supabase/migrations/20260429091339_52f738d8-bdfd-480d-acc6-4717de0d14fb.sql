DROP POLICY IF EXISTS "Anyone can submit applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Anyone can create leads" ON public.leads;

CREATE POLICY "Anyone can submit applications"
ON public.finance_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(full_name)) > 1
  AND position('@' in email) > 1
  AND length(trim(phone)) >= 6
  AND (user_id IS NULL OR auth.uid() = user_id)
);

CREATE POLICY "Anyone can create leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(coalesce(client_email, ''))) > 3
  OR length(trim(coalesce(client_phone, ''))) >= 6
  OR length(trim(coalesce(client_name, ''))) > 1
);