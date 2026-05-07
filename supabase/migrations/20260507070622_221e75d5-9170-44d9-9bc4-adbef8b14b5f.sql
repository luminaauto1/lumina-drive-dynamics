
CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'easysocial',
  seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_seen_at
  ON public.webhook_events (seen_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies: service-role bypasses RLS; everyone else is locked out.
