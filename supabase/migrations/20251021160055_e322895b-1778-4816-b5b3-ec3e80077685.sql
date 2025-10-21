-- Make company field required for customers table
ALTER TABLE public.customers 
ALTER COLUMN company SET NOT NULL;