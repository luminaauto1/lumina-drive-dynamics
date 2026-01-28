-- 1. Store Add-ons as robust JSONB
-- Structure: [{ name: string, cost: number, price: number }]
ALTER TABLE deal_records ADD COLUMN IF NOT EXISTS addons_data JSONB DEFAULT '[]'::jsonb;

-- 2. Flexible Partner Split Type
ALTER TABLE deal_records ADD COLUMN IF NOT EXISTS partner_split_type TEXT DEFAULT 'percentage'; -- 'percentage' or 'fixed'

-- 3. Partner Split Value (reusable for both percentage and fixed amount)
ALTER TABLE deal_records ADD COLUMN IF NOT EXISTS partner_split_value NUMERIC DEFAULT 0;