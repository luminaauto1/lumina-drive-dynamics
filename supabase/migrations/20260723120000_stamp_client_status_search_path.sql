-- Pin stamp_client_status_change's search_path, matching its sibling
-- stamp_status_change. The prior migration created it without a SET search_path,
-- which the Supabase security advisor flags (function_search_path_mutable) and is
-- inconsistent with the rest of the trigger functions. Behaviour is unchanged —
-- it only ever assigns a NEW column and calls now(); this is hygiene + advisor-clean.

CREATE OR REPLACE FUNCTION public.stamp_client_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.client_status_updated_at := now();
  RETURN NEW;
END;
$$;
