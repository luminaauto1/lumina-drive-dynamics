DROP POLICY IF EXISTS "Anyone can update their draft by session" ON public.application_drafts;

CREATE POLICY "Anyone can update unsubmitted drafts"
ON public.application_drafts FOR UPDATE
TO anon, authenticated
USING (submitted = false)
WITH CHECK (
  length(trim(last_completed_step)) BETWEEN 1 AND 100
);