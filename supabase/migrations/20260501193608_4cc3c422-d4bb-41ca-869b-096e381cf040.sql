
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_step_reached integer,
  ADD COLUMN IF NOT EXISTS last_step_name text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS referrer text;

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_last_step ON public.leads (last_step_reached);
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON public.leads (utm_source);
