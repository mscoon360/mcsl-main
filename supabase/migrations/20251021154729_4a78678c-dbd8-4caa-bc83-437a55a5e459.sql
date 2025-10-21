-- Make email optional for customers table
ALTER TABLE public.customers 
ALTER COLUMN email DROP NOT NULL;