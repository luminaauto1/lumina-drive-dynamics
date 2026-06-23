-- Enable Supabase Realtime for finance_applications so the admin Finance tab and
-- the directed-note Action Feed update LIVE (no manual refresh). postgres_changes
-- still honours RLS, so only staff who can SELECT a row receive its change events.
-- Additive + idempotent: only adds the table to the realtime publication if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'finance_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_applications;
  END IF;
END $$;
