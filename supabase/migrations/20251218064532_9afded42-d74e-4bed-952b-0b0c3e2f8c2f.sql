-- Add selling quantity fields to products table
ALTER TABLE public.products
ADD COLUMN selling_unit_qty integer NULL,
ADD COLUMN selling_unit_type text NULL,
ADD COLUMN price_per_unit numeric NULL;