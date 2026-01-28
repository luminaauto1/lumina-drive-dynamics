-- Add DIC (Dealer Incentive Commission - Bank Reward) column
-- This is pure profit from banks that does NOT affect client invoice
ALTER TABLE deal_records ADD COLUMN IF NOT EXISTS dic_amount NUMERIC DEFAULT 0;