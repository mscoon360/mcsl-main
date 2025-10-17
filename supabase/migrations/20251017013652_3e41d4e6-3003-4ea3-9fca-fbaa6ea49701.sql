-- Add supplier info and cost tracking to products table
ALTER TABLE products 
ADD COLUMN supplier_name TEXT,
ADD COLUMN min_stock INTEGER DEFAULT 0,
ADD COLUMN cost_price NUMERIC;