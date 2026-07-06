-- Widen integration_settings SELECT so the finance roles can read the SIGNIO row.
-- Push to Signio lives in the Deal Room and is used by f_and_i / senior_f_and_i /
-- accountant — but is_staff() covers only admin + sales_agent, so for those users
-- the 'signio' read returned no row and the button silently fell back to the
-- built-in default links (defeating the Settings-managed links feature).
-- Scoped to key='signio' only — the EasySocial row (holds the API key) stays
-- readable by is_staff() exactly as before.
DROP POLICY IF EXISTS integ_select ON public.integration_settings;
CREATE POLICY integ_select ON public.integration_settings
  FOR SELECT USING (
    is_staff(auth.uid())
    OR (
      key = 'signio' AND (
        has_role(auth.uid(), 'f_and_i'::app_role)
        OR has_role(auth.uid(), 'senior_f_and_i'::app_role)
        OR has_role(auth.uid(), 'accountant'::app_role)
      )
    )
  );
