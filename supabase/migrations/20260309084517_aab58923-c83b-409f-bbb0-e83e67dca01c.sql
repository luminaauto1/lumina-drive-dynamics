ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS default_balloon_percent NUMERIC DEFAULT 0;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS monthly_sales_target NUMERIC DEFAULT 0;