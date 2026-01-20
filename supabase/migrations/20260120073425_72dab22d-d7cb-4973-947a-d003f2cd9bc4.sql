-- 1. Drop existing status constraint if it exists
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;

-- 2. Add new constraint with ALL required statuses including 'sourcing' and 'hidden'
ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check 
CHECK (status IN ('available', 'reserved', 'sold', 'incoming', 'sourcing', 'hidden'));