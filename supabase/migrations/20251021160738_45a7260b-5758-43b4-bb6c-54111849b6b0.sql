-- Add address_2 and zone fields to customers table
ALTER TABLE public.customers 
ADD COLUMN address_2 text,
ADD COLUMN zone text;