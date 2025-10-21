-- Make name (representative name) optional for customers table
ALTER TABLE public.customers 
ALTER COLUMN name DROP NOT NULL;