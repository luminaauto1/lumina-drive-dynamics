
-- 1. Add Partner Capital Contribution to deal_records
ALTER TABLE deal_records 
ADD COLUMN IF NOT EXISTS partner_capital_contribution NUMERIC DEFAULT 0;

-- 2. Add "deal_type" flag to finance_applications
ALTER TABLE finance_applications
ADD COLUMN IF NOT EXISTS deal_type TEXT DEFAULT 'finance';
