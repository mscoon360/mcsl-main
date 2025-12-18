-- Create rental_product_costs table (summary level per product)
CREATE TABLE public.rental_product_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_cost NUMERIC DEFAULT 0,
  refill_cost NUMERIC DEFAULT 0,
  battery_cost NUMERIC DEFAULT 0,
  battery_frequency_months INTEGER DEFAULT 12,
  indirect_cost_percentage NUMERIC DEFAULT 12.5,
  notes TEXT,
  prepared_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Create rental_cost_items table (individual expense line items)
CREATE TABLE public.rental_cost_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_cost_id UUID NOT NULL REFERENCES public.rental_product_costs(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('labour', 'vehicles', 'supplies', 'contingency', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_cost NUMERIC DEFAULT 0,
  usage_rate TEXT,
  monthly_cost NUMERIC DEFAULT 0,
  annual_cost NUMERIC DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rental_product_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_cost_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rental_product_costs
CREATE POLICY "Users can view all rental costs"
ON public.rental_product_costs FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own rental costs"
ON public.rental_product_costs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rental costs"
ON public.rental_product_costs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any rental costs"
ON public.rental_product_costs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own rental costs"
ON public.rental_product_costs FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for rental_cost_items
CREATE POLICY "Users can view all rental cost items"
ON public.rental_cost_items FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own rental cost items"
ON public.rental_cost_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rental cost items"
ON public.rental_cost_items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any rental cost items"
ON public.rental_cost_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own rental cost items"
ON public.rental_cost_items FOR DELETE
USING (auth.uid() = user_id);

-- Create updated_at triggers
CREATE TRIGGER update_rental_product_costs_updated_at
BEFORE UPDATE ON public.rental_product_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rental_cost_items_updated_at
BEFORE UPDATE ON public.rental_cost_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();