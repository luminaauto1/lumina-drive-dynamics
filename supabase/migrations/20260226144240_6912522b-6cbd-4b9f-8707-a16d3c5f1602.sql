-- Tighten analytics_events: validate event_type and limit event_data size
CREATE OR REPLACE FUNCTION public.validate_analytics_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Whitelist allowed event types
  IF NEW.event_type NOT IN (
    'page_view', 'vehicle_view', 'search', 'filter', 'click',
    'finance_calculator', 'wishlist_add', 'wishlist_remove',
    'compare_add', 'compare_remove', 'form_start', 'form_submit',
    'cta_click', 'scroll_depth', 'session_start', 'session_end'
  ) THEN
    RAISE EXCEPTION 'Invalid event_type: %', NEW.event_type;
  END IF;

  -- Limit event_data size (max 4KB)
  IF NEW.event_data IS NOT NULL AND length(NEW.event_data::text) > 4096 THEN
    RAISE EXCEPTION 'event_data too large (max 4KB)';
  END IF;

  -- Validate session_id format if provided
  IF NEW.session_id IS NOT NULL AND length(NEW.session_id) > 100 THEN
    RAISE EXCEPTION 'Invalid session_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_analytics_event_trigger
BEFORE INSERT ON public.analytics_events
FOR EACH ROW
EXECUTE FUNCTION public.validate_analytics_event();
