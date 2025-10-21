-- Make company optional for customers table
ALTER TABLE public.customers 
ALTER COLUMN company DROP NOT NULL;