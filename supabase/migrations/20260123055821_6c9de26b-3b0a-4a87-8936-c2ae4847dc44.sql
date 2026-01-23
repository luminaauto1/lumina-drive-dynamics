-- 1. Add "Validations Confirmed" to status (drop old constraint if exists)
ALTER TABLE finance_applications DROP CONSTRAINT IF EXISTS finance_applications_status_check;
ALTER TABLE finance_applications ADD CONSTRAINT finance_applications_status_check 
CHECK (status IN ('pending', 'under_review', 'validations_pending', 'validations_confirmed', 'approved', 'declined', 'vehicle_selected', 'finalized', 'archived', 'draft', 'processing'));

-- 2. Add "Second Income" column
ALTER TABLE finance_applications ADD COLUMN IF NOT EXISTS additional_income NUMERIC DEFAULT 0;