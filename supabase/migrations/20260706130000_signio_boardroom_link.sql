-- Append the third Signio portal — "Signio Direct Submit" (Lightstone
-- Signing-Boardroom e-application) — to the Settings-managed link list.
-- Idempotent + edit-preserving: only appends when no link with
-- system='boardroom' exists yet; never touches the owner's other links
-- or the default choice.
UPDATE public.integration_settings
SET config = jsonb_set(
      config,
      '{links}',
      COALESCE(config->'links', '[]'::jsonb) || jsonb_build_object(
        'id', 'boardroom',
        'label', 'Signio Direct Submit',
        'url', 'https://lightstone.signio.co.za/Signing-Boardroom/application/index?deal=0',
        'system', 'boardroom'
      )
    ),
    updated_at = now()
WHERE key = 'signio'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(config->'links', '[]'::jsonb)) l
    WHERE l->>'system' = 'boardroom'
  );
