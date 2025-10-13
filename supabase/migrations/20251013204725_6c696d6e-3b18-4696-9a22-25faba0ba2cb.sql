-- Add destination_address column to product_items table
ALTER TABLE public.product_items 
ADD COLUMN destination_address text;