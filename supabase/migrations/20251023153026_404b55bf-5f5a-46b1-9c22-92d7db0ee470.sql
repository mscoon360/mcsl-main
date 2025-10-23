-- Make customer name nullable and company required
ALTER TABLE public.customers 
  ALTER COLUMN name DROP NOT NULL;

-- Add check constraint to ensure company is not empty
ALTER TABLE public.customers 
  ADD CONSTRAINT company_not_empty CHECK (company IS NOT NULL AND company <> '');