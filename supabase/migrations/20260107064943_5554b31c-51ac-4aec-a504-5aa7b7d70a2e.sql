-- 1. REMOVE THE STATUS RESTRICTION (Fixes "Violates Check Constraint" errors)
ALTER TABLE finance_applications DROP CONSTRAINT IF EXISTS finance_applications_status_check;

-- 2. ADD ANTI-TIME WASTING COLUMNS (if not exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_applications' AND column_name = 'has_drivers_license') THEN
    ALTER TABLE finance_applications ADD COLUMN has_drivers_license BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_applications' AND column_name = 'credit_score_status') THEN
    ALTER TABLE finance_applications ADD COLUMN credit_score_status TEXT DEFAULT 'unsure';
  END IF;
END $$;

-- 3. ADD SETTINGS COLUMNS (if not exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'min_interest') THEN
    ALTER TABLE site_settings ADD COLUMN min_interest NUMERIC DEFAULT 10.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'max_interest') THEN
    ALTER TABLE site_settings ADD COLUMN max_interest NUMERIC DEFAULT 25.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'min_deposit_percent') THEN
    ALTER TABLE site_settings ADD COLUMN min_deposit_percent NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'tiktok_url') THEN
    ALTER TABLE site_settings ADD COLUMN tiktok_url TEXT;
  END IF;
END $$;