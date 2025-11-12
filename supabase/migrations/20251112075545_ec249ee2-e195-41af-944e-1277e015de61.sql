-- Remove date fields and add stock tracking to item_dependencies
ALTER TABLE item_dependencies 
DROP COLUMN IF EXISTS last_serviced_date,
DROP COLUMN IF EXISTS next_service_date,
ADD COLUMN IF NOT EXISTS current_stock integer DEFAULT 0;