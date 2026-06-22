-- ============================================================================
-- ZTC-parity settings: EasySocial control, WhatsApp templates, status overrides.
-- All additive + fallback-safe: empty tables = current behaviour preserved.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integration_settings (
  key        text PRIMARY KEY,
  active     boolean NOT NULL DEFAULT true,
  config     jsonb   NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.integration_settings(key, active, config)
VALUES ('easysocial', true, '{}'::jsonb) ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integ_select ON public.integration_settings;
DROP POLICY IF EXISTS integ_write  ON public.integration_settings;
CREATE POLICY integ_select ON public.integration_settings FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY integ_write  ON public.integration_settings FOR ALL    TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  key        text PRIMARY KEY,
  title      text NOT NULL,
  body       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wt_select ON public.whatsapp_templates;
DROP POLICY IF EXISTS wt_write  ON public.whatsapp_templates;
CREATE POLICY wt_select ON public.whatsapp_templates FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY wt_write  ON public.whatsapp_templates FOR ALL    TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- SLUGS ARE FIXED — only presentation (label/colour/order/visibility) is overridable,
-- so the mailer / notify / pipeline slug contracts never break.
CREATE TABLE IF NOT EXISTS public.status_overrides (
  slug        text PRIMARY KEY,
  label       text,
  color_class text,
  sort_order  integer,
  is_hidden   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.status_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS so_select ON public.status_overrides;
DROP POLICY IF EXISTS so_write  ON public.status_overrides;
CREATE POLICY so_select ON public.status_overrides FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY so_write  ON public.status_overrides FOR ALL    TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
