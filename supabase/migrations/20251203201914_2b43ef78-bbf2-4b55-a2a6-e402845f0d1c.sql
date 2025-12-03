-- Add inventory_status to track order progress for restock orders
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS inventory_status text DEFAULT NULL;

-- Add stock_updated flag to prevent double updates
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS stock_updated boolean DEFAULT false;