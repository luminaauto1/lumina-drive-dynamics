-- Allow anonymous and authenticated users to view listable vehicles on the public site
CREATE POLICY "Public can view listable vehicles"
  ON public.vehicles FOR SELECT TO anon, authenticated
  USING (status IN ('available','sourcing','incoming') OR is_featured = true);

-- Allow anonymous and authenticated users to read site configuration (singleton settings)
CREATE POLICY "Public can view site settings"
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);