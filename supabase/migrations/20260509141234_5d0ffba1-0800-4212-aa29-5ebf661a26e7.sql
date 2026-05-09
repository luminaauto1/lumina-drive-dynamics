ALTER TABLE public.application_drafts ADD COLUMN IF NOT EXISTS abandonment_flags text[] NOT NULL DEFAULT '{}'::text[];

DROP POLICY IF EXISTS "Anyone can update unsubmitted drafts" ON public.application_drafts;
CREATE POLICY "Anyone can update unsubmitted drafts"
ON public.application_drafts
FOR UPDATE
TO anon, authenticated
USING (submitted = false)
WITH CHECK (length(TRIM(BOTH FROM last_completed_step)) >= 1 AND length(TRIM(BOTH FROM last_completed_step)) <= 100);