-- Add sourced_count column to vehicles for evergreen sourcing templates
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS sourced_count INTEGER DEFAULT 0;