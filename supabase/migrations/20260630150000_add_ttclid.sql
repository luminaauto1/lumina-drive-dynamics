-- TikTok click-id (ttclid) passthrough for CAPI attribution. Additive only.
-- (Applied to the live DB via Supabase MCP; committed here for migration history.)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ttclid text;
ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS ttclid text;

COMMENT ON COLUMN public.leads.ttclid IS
  'TikTok click identifier (ttclid) captured from the ad-click URL — used to attribute CAPI conversion events back to TikTok.';
COMMENT ON COLUMN public.finance_applications.ttclid IS
  'TikTok click identifier (ttclid) carried from the website session — used for CAPI conversion attribution.';
