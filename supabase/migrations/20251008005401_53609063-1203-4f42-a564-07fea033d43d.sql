-- Add units column to products table
ALTER TABLE public.products
ADD COLUMN units text;

COMMENT ON COLUMN public.products.units IS 'Unit of measurement for the product (e.g., cases, ml, gallons, litres, units)';