-- Add vatable field to customers table
ALTER TABLE public.customers
ADD COLUMN vatable boolean DEFAULT false;

-- Add needs_servicing field to products table
ALTER TABLE public.products
ADD COLUMN needs_servicing boolean DEFAULT false;

-- Create item_dependencies table for tracking servicing schedules
CREATE TABLE public.item_dependencies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  servicing_frequency text NOT NULL,
  description text,
  last_serviced_date date,
  next_service_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL
);

-- Enable RLS on item_dependencies
ALTER TABLE public.item_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS policies for item_dependencies
CREATE POLICY "Authenticated users can view all item dependencies"
ON public.item_dependencies
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert item dependencies"
ON public.item_dependencies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own item dependencies"
ON public.item_dependencies
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own item dependencies"
ON public.item_dependencies
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any item dependencies"
ON public.item_dependencies
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger for item_dependencies
CREATE TRIGGER update_item_dependencies_updated_at
BEFORE UPDATE ON public.item_dependencies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add vat_amount column to sales table to track VAT
ALTER TABLE public.sales
ADD COLUMN vat_amount numeric DEFAULT 0;

-- Add vat_amount column to sale_items table
ALTER TABLE public.sale_items
ADD COLUMN vat_amount numeric DEFAULT 0;