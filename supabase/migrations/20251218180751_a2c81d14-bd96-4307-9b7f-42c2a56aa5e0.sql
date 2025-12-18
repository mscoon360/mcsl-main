-- Drop the existing check constraint and add a new one with 'nis' included
ALTER TABLE public.rental_cost_items 
DROP CONSTRAINT IF EXISTS rental_cost_items_category_check;

ALTER TABLE public.rental_cost_items 
ADD CONSTRAINT rental_cost_items_category_check 
CHECK (category IN ('labour', 'nis', 'vehicles', 'supplies', 'contingency', 'other'));