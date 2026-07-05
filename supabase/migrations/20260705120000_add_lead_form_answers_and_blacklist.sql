-- TikTok form answers: compact structured storage + fast blacklist counting.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS form_answers jsonb,
  ADD COLUMN IF NOT EXISTS is_blacklisted boolean;

COMMENT ON COLUMN public.leads.form_answers IS
  'Compact TikTok lead-form answers, e.g. {"blacklisted","employed","licence"}; keys omitted when absent';
COMMENT ON COLUMN public.leads.is_blacklisted IS
  'Derived from the "Are you blacklisted?" form answer. NULL = unknown/unparseable.';

-- Backfill: legacy make.com payloads concatenated all form answers into notes as
-- "Bank qualification / buying power: <blacklisted> <employed> <licence>".
-- The first Yes/No token after the prefix is the blacklist answer.
UPDATE public.leads
SET is_blacklisted =
  (lower(substring(notes FROM '(?i)^bank qualification / buying power:\s*(yes|no)\M')) = 'yes')
WHERE is_blacklisted IS NULL
  AND notes ~* '^bank qualification / buying power:\s*(yes|no)\M';

NOTIFY pgrst, 'reload schema';
