-- Update default status for product_items to 'in storage'
ALTER TABLE public.product_items 
ALTER COLUMN status SET DEFAULT 'in storage';