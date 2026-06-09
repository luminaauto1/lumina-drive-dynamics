ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS credit_check_status text,
  ADD COLUMN IF NOT EXISTS status_screenshot_url text;