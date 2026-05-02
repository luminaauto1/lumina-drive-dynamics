-- Drop the partial index — supabase-js upsert can't target a partial unique
-- index, so ON CONFLICT (phone_number) failed. Replace with a real UNIQUE
-- constraint. NULL phone_numbers remain allowed (PG treats NULLs as distinct).
DROP INDEX IF EXISTS public.leads_phone_number_unique_idx;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_phone_number_unique UNIQUE (phone_number);