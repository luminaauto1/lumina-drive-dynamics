CREATE TABLE public.application_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  last_completed_step text NOT NULL,
  step_number integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_application_drafts_step ON public.application_drafts(last_completed_step);
CREATE INDEX idx_application_drafts_updated ON public.application_drafts(updated_at DESC);

ALTER TABLE public.application_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert drafts"
ON public.application_drafts FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(session_id)) BETWEEN 8 AND 100
  AND length(trim(last_completed_step)) BETWEEN 1 AND 100
);

CREATE POLICY "Anyone can update their draft by session"
ON public.application_drafts FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (
  length(trim(last_completed_step)) BETWEEN 1 AND 100
);

CREATE POLICY "Admins can view drafts"
ON public.application_drafts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales agents can view drafts"
ON public.application_drafts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY "Admins can delete drafts"
ON public.application_drafts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_application_drafts_updated_at
BEFORE UPDATE ON public.application_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();