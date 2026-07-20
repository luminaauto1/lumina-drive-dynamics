-- ============================================================================
-- F&I staff can read the reference data the admin UI needs (owner, 2026-07-20)
-- ============================================================================
-- Reported: a senior F&I user opens Change status → Current Client Status and
-- sees "No client statuses defined yet", while an admin sees them all.
--
-- Root cause: public.is_staff() resolves to admin OR sales_agent ONLY. It does
-- NOT include f_and_i or senior_f_and_i — 13 of 17 users. Ten SELECT policies
-- gate on it, so those users silently read ZERO rows from the tables that drive
-- the UI (statuses, pipeline lanes, banks, role grants, …). Nothing errors; the
-- lists just come back empty, which is why it looks like "no statuses defined".
--
-- Deliberately NOT widening is_staff() itself: it is also the authorization gate
-- inside finalize_deal_atomic() ("only staff may finalize deals"), so widening
-- it would hand deal-finalisation to every f_and_i user as a side effect. That
-- is an authorization decision for the owner, not a side effect of a read fix.
--
-- Instead: a new is_any_staff() for "any staff role", used ONLY for reference
-- reads. Credential-bearing tables are handled separately (see below).

CREATE OR REPLACE FUNCTION public.is_any_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'sales_agent'::app_role,
                   'f_and_i'::app_role, 'senior_f_and_i'::app_role)
  )
$function$;

COMMENT ON FUNCTION public.is_any_staff(uuid) IS
  'TRUE for any staff role (admin, sales_agent, f_and_i, senior_f_and_i). Use for READ access to reference data the admin UI needs. is_staff() is narrower (admin + sales_agent) and also gates finalize_deal_atomic - do not conflate them.';

-- ---------------------------------------------------------------------------
-- Reference data every staff member needs to render the UI. Read-only; none of
-- these carry credentials. Writes are untouched (still admin-gated).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "so_select" ON public.status_overrides;
CREATE POLICY "so_select" ON public.status_overrides
  FOR SELECT TO authenticated USING (public.is_any_staff(auth.uid()));

DROP POLICY IF EXISTS "plo_select" ON public.pipeline_lane_overrides;
CREATE POLICY "plo_select" ON public.pipeline_lane_overrides
  FOR SELECT TO authenticated USING (public.is_any_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can read banks" ON public.finance_banks;
CREATE POLICY "Staff can read banks" ON public.finance_banks
  FOR SELECT TO authenticated USING (public.is_any_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can read role section access" ON public.role_section_access;
CREATE POLICY "Staff can read role section access" ON public.role_section_access
  FOR SELECT TO authenticated USING (public.is_any_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view all roles" ON public.user_roles;
CREATE POLICY "Staff can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_any_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can read app visibility" ON public.app_visibility_rules;
CREATE POLICY "Staff can read app visibility" ON public.app_visibility_rules
  FOR SELECT TO authenticated USING (public.is_any_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can read export presets" ON public.export_presets;
CREATE POLICY "Staff can read export presets" ON public.export_presets
  FOR SELECT TO authenticated USING (public.is_any_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read pre-approval notify queue" ON public.pre_approval_notify_queue;
CREATE POLICY "Staff read pre-approval notify queue" ON public.pre_approval_notify_queue
  FOR SELECT TO authenticated USING (public.is_any_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Credential-bearing tables: widen deliberately, not by default.
-- ---------------------------------------------------------------------------
-- whatsapp_templates.send_url IS the send credential (campaign token baked in).
-- Only admin settings screens read this table (StatusEditModal,
-- WhatsAppTemplatesTab), so admin + senior F&I is the right audience - it is NOT
-- widened to every f_and_i user.
DROP POLICY IF EXISTS "wt_select" ON public.whatsapp_templates;
CREATE POLICY "wt_select" ON public.whatsapp_templates
  FOR SELECT TO authenticated USING (public.can_deal_desk());

-- integration_settings holds BOTH the EasySocial API config (sensitive) and the
-- Signio portal links, and PushToSignioButton - an everyday F&I tool - needs the
-- Signio row. So: full read stays admin + senior F&I, plus a narrow row-level
-- grant letting any staff member read ONLY the 'signio' row. (F&I could not read
-- it at all before, so Push-to-Signio was silently falling back to the hardcoded
-- default links.)
DROP POLICY IF EXISTS "integ_select" ON public.integration_settings;
CREATE POLICY "integ_select" ON public.integration_settings
  FOR SELECT TO authenticated USING (public.can_deal_desk());

DROP POLICY IF EXISTS "integ_select_signio_staff" ON public.integration_settings;
CREATE POLICY "integ_select_signio_staff" ON public.integration_settings
  FOR SELECT TO authenticated USING (key = 'signio' AND public.is_any_staff(auth.uid()));
