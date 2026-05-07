
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS easysocial_id text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS origin text;

CREATE UNIQUE INDEX IF NOT EXISTS leads_easysocial_id_key
  ON public.leads (easysocial_id)
  WHERE easysocial_id IS NOT NULL;
