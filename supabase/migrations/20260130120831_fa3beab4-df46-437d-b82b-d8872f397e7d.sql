-- Add sale_date column to deal_records
ALTER TABLE deal_records ADD COLUMN IF NOT EXISTS sale_date DATE DEFAULT CURRENT_DATE;

-- Backfill existing deals to use their created_at date if sale_date is null
UPDATE deal_records SET sale_date = DATE(created_at) WHERE sale_date IS NULL;