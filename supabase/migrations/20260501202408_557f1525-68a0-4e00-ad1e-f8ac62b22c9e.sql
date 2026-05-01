ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS traffic_source TEXT,
  ADD COLUMN IF NOT EXISTS bot_outcome TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Unique index for upsert matching (partial: only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_number_unique_idx
  ON public.leads (phone_number)
  WHERE phone_number IS NOT NULL;