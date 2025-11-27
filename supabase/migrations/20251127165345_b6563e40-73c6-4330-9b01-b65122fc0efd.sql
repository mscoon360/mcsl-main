-- Add division and subdivision references to products table
ALTER TABLE products 
ADD COLUMN division_id uuid REFERENCES divisions(id) ON DELETE SET NULL,
ADD COLUMN subdivision_id uuid REFERENCES subdivisions(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX idx_products_division_id ON products(division_id);
CREATE INDEX idx_products_subdivision_id ON products(subdivision_id);