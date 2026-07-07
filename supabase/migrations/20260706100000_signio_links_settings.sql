-- Signio portal links → integration_settings (managed in Admin → Settings → Signio Links).
-- Each link carries the portal URL plus which fill SYSTEM its form uses
-- ('lightstone' one-page e-application vs 'wizard' 7-step). The Push-to-Signio
-- button opens the default link; the fill engine gets the system as a hint.
-- Seed only — ON CONFLICT DO NOTHING so an owner-edited config is never clobbered.
-- Default = the one-page LIGHTSTONE portal (owner decision, 2026-07-06).
INSERT INTO public.integration_settings (key, active, config)
VALUES (
  'signio',
  true,
  jsonb_build_object(
    'links', jsonb_build_array(
      jsonb_build_object(
        'id', 'lightstone',
        'label', 'One-page portal (LIGHTSTONE)',
        'url', 'https://thirdparty.signio.co.za/ThirdPartyIntegration/application?skin=LIGHTSTONE&uuid=0000019e-fdf8-8197-9b9e-d86384f9e897',
        'system', 'lightstone'
      ),
      jsonb_build_object(
        'id', 'wizard',
        'label', '7-step wizard portal',
        'url', 'https://goa.signio.co.za/ThirdPartyIntegration/?uuid=00000195-23bc-3df6-8b41-6b29efa3f893',
        'system', 'wizard'
      )
    ),
    'default_id', 'lightstone'
  )
)
ON CONFLICT (key) DO NOTHING;
