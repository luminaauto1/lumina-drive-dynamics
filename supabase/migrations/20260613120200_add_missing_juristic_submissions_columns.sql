-- JuristicCapture.tsx writes registered_office, years_in_business and signed_at
-- on every autosave/submit, but these columns were created on the old Lovable DB
-- via the dashboard (never as a migration) so the production replay missed them.
-- Result: the entire company-finance capture form failed to save with the same
-- PostgREST "column not found" error class as the Finalize Deal bug.
ALTER TABLE public.juristic_submissions
  ADD COLUMN IF NOT EXISTS registered_office  text,
  ADD COLUMN IF NOT EXISTS years_in_business  text,
  ADD COLUMN IF NOT EXISTS signed_at          text;

NOTIFY pgrst, 'reload schema';
