-- Add column for Referral Income (Money we RECEIVE, unlike referral_commission_amount which we PAY)
ALTER TABLE deal_records 
ADD COLUMN IF NOT EXISTS referral_income_amount NUMERIC DEFAULT 0;