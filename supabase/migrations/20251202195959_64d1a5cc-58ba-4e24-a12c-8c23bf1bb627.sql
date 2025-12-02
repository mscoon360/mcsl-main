-- Add container_size to products for repackaging
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS container_size text;

-- Add fulfillment tracking to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS is_fulfilled boolean DEFAULT false;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS fulfilled_at timestamp with time zone;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS fulfilled_by uuid;