-- Fix: RLS Policy Always True on analytics_events (INSERT with WITH CHECK (true))
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

-- Allow inserts but restrict: user_id must be null (anonymous) or match authenticated user
CREATE POLICY "Validated analytics inserts only"
ON public.analytics_events
FOR INSERT
WITH CHECK (
  user_id IS NULL OR user_id::text = auth.uid()::text
);