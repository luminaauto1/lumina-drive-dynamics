ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS ai_vehicle_interest text,
  ADD COLUMN IF NOT EXISTS ai_budget text,
  ADD COLUMN IF NOT EXISTS ai_timeline text,
  ADD COLUMN IF NOT EXISTS last_contacted_date date,
  ADD COLUMN IF NOT EXISTS follow_up_time time;