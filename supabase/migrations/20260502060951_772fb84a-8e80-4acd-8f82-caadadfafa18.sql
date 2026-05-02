-- Deduplicate any existing rows that share a phone_number, keeping the most recent
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY phone_number
           ORDER BY updated_at DESC NULLS LAST, created_at DESC
         ) AS rn
  FROM public.leads
  WHERE phone_number IS NOT NULL
    AND length(trim(phone_number)) > 0
)
DELETE FROM public.leads l
USING ranked r
WHERE l.id = r.id AND r.rn > 1;

-- Partial unique index allows multiple NULL phone_numbers but enforces uniqueness on real values.
-- This satisfies ON CONFLICT (phone_number) targeting in the edge function.
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_number_key
  ON public.leads (phone_number)
  WHERE phone_number IS NOT NULL;