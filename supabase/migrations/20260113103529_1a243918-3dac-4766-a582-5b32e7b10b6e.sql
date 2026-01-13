-- Add profitability tracking columns to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS purchase_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reconditioning_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_profit NUMERIC GENERATED ALWAYS AS (price - COALESCE(purchase_price, 0) - COALESCE(reconditioning_cost, 0)) STORED;