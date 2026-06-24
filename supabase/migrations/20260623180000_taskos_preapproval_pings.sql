-- Per-client throttle for the pre-approval doc-chase: lets the digest re-ask about the
-- SAME pre-approved client ~hourly until it's marked contacted (instead of once a day).
-- Accessed only by the service-role edge functions; RLS on with no policies = locked to
-- service role.
CREATE TABLE IF NOT EXISTS public.taskos_preapproval_pings (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id  uuid NOT NULL REFERENCES public.finance_applications(id) ON DELETE CASCADE,
  last_pinged_at  timestamptz NOT NULL DEFAULT now(),
  last_message_id bigint,
  PRIMARY KEY (user_id, application_id)
);
ALTER TABLE public.taskos_preapproval_pings ENABLE ROW LEVEL SECURITY;
