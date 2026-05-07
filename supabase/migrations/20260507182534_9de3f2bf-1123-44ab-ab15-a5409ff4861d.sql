GRANT INSERT, UPDATE ON TABLE public.application_drafts TO anon, authenticated;
GRANT SELECT ON TABLE public.application_drafts TO authenticated;

DROP POLICY IF EXISTS "Applicants can read unsubmitted draft for upsert" ON public.application_drafts;

CREATE POLICY "Applicants can read unsubmitted draft for upsert"
ON public.application_drafts
FOR SELECT
TO anon, authenticated
USING (submitted = false);
