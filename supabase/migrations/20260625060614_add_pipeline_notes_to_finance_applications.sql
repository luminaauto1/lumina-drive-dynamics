-- Pipeline v2 structured notes.
-- Stores an array of { id, body, category, author_id, author_name, created_at }
-- so each note carries an author + timestamp + optional category badge.
-- Additive and defaulted: the legacy free-text `notes` column (still read by
-- AdminFinance and the pre-approval WhatsApp) is left completely untouched.
ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS pipeline_notes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.finance_applications.pipeline_notes IS
  'Pipeline v2 structured notes (newest-first JSON array): {id, body, category, author_id, author_name, created_at}. Pure lead-data; never fires status notifications.';
