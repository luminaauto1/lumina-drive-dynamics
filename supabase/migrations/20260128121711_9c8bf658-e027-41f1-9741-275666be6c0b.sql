-- Add referral commission fields to deal_records
ALTER TABLE deal_records 
ADD COLUMN IF NOT EXISTS referral_commission_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_person_name TEXT;