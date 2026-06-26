-- Phase D: link F&I users to a "Finance House" vendor, and per-company finance stats.
-- Additive only: one new nullable column + one read-only aggregate RPC. No existing
-- column/table is altered; nothing reads this column in the frozen finalize path.
-- (Applied to the live DB via Supabase MCP; committed here for migration history.)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS f_and_i_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_f_and_i_vendor_id
  ON public.profiles(f_and_i_vendor_id) WHERE f_and_i_vendor_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.f_and_i_vendor_id IS
  'Optional link to the Finance House (vendors.id, vendor_type finance_house/both) this F&I user belongs to. Used only for per-company statistics.';

-- Per-Finance-House aggregate stats over finance_applications in a date window.
-- Attributes each application to the vendor of its handling F&I user
-- (assigned_f_and_i, else created_by). Read-only; aggregates only (no PII).
CREATE OR REPLACE FUNCTION public.lum_vendor_finance_stats(
  p_since timestamptz,
  p_until timestamptz
)
RETURNS TABLE (
  vendor_id        uuid,
  vendor_name      text,
  fni_count        bigint,
  app_count        bigint,
  approved_count   bigint,
  declined_count   bigint,
  approval_rate    numeric,
  finalized_count  bigint,
  total_sold_value numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH handler_vendor AS (
    SELECT fa.id AS app_id, fa.status, p.f_and_i_vendor_id AS vendor_id
    FROM finance_applications fa
    JOIN profiles p ON p.user_id = COALESCE(fa.assigned_f_and_i, fa.created_by)
    WHERE p.f_and_i_vendor_id IS NOT NULL
      AND fa.created_at >= p_since AND fa.created_at < p_until
  ),
  deal_value AS (
    SELECT hv.vendor_id, SUM(dr.sold_price) AS sold_value, COUNT(dr.id) AS finalized
    FROM handler_vendor hv
    JOIN deal_records dr ON dr.application_id = hv.app_id
    GROUP BY hv.vendor_id
  ),
  fni_counts AS (
    SELECT f_and_i_vendor_id AS vendor_id, COUNT(*) AS fni_count
    FROM profiles
    WHERE f_and_i_vendor_id IS NOT NULL
    GROUP BY f_and_i_vendor_id
  )
  SELECT
    v.id,
    v.name,
    COALESCE(fc.fni_count, 0)::bigint,
    COUNT(hv.app_id)::bigint,
    COUNT(hv.app_id) FILTER (WHERE lum_is_approved(hv.status))::bigint,
    COUNT(hv.app_id) FILTER (WHERE lum_is_declined(hv.status))::bigint,
    CASE WHEN COUNT(hv.app_id) > 0
         THEN ROUND(100.0 * COUNT(hv.app_id) FILTER (WHERE lum_is_approved(hv.status)) / COUNT(hv.app_id), 1)
         ELSE 0 END,
    COALESCE(dv.finalized, 0)::bigint,
    COALESCE(dv.sold_value, 0)::numeric
  FROM vendors v
  LEFT JOIN handler_vendor hv ON hv.vendor_id = v.id
  LEFT JOIN deal_value dv ON dv.vendor_id = v.id
  LEFT JOIN fni_counts fc ON fc.vendor_id = v.id
  WHERE v.vendor_type IN ('finance_house', 'both')
  GROUP BY v.id, v.name, fc.fni_count, dv.finalized, dv.sold_value
  ORDER BY v.name;
$$;

GRANT EXECUTE ON FUNCTION public.lum_vendor_finance_stats(timestamptz, timestamptz) TO authenticated;
