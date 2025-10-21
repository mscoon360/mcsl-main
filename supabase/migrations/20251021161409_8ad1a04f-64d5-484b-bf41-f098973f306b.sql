-- Make name mandatory for customers table
ALTER TABLE public.customers 
ALTER COLUMN name SET NOT NULL;