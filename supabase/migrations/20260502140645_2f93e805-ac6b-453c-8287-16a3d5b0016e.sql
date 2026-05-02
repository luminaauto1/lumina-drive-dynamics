-- Add a partial UNIQUE index on leads.phone_number so the easysocial-webhook
-- upsert (onConflict: 'phone_number') can succeed. Partial WHERE clause keeps
-- existing/legacy website leads (which leave phone_number NULL) unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_number_unique_idx
  ON public.leads (phone_number)
  WHERE phone_number IS NOT NULL;