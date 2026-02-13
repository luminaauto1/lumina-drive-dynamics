
-- 1. Create a function that checks for active deals before deletion
CREATE OR REPLACE FUNCTION public.prevent_sold_vehicle_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM deal_records WHERE vehicle_id = OLD.id) THEN
        RAISE EXCEPTION 'This vehicle is part of a finalized deal. Reverse the deal first to delete it.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Attach the trigger to the vehicles table
DROP TRIGGER IF EXISTS check_vehicle_sold_before_delete ON vehicles;
CREATE TRIGGER check_vehicle_sold_before_delete
BEFORE DELETE ON vehicles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sold_vehicle_deletion();
