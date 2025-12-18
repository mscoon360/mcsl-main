-- Create rental_payment_terms table to store different payment term pricing for rental products
CREATE TABLE public.rental_payment_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payment_term TEXT NOT NULL CHECK (payment_term IN ('weekly', 'bi-weekly', 'monthly')),
  rental_price NUMERIC NOT NULL,
  unit_cost NUMERIC DEFAULT 0,
  refill_cost NUMERIC DEFAULT 0,
  battery_cost NUMERIC DEFAULT 0,
  battery_frequency_months INTEGER DEFAULT 12,
  indirect_cost_percentage NUMERIC DEFAULT 12.5,
  total_direct_costs NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  margin_percentage NUMERIC DEFAULT 0,
  notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, payment_term)
);

-- Enable RLS
ALTER TABLE public.rental_payment_terms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all rental payment terms"
ON public.rental_payment_terms
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own rental payment terms"
ON public.rental_payment_terms
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rental payment terms"
ON public.rental_payment_terms
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rental payment terms"
ON public.rental_payment_terms
FOR DELETE
USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_rental_payment_terms_updated_at
BEFORE UPDATE ON public.rental_payment_terms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the weekly and bi-weekly payment terms for Auto ADU Unit(Foreign)
-- Auto ADU Unit(Foreign) - Weekly: $1,570/yr = $30.19/wk, Bi-weekly: $1,285/yr = $24.71/wk
-- Manual ADU Unit(Foreign) - Weekly: $1,400/yr = $26.92/wk, Bi-weekly: $1,020/yr = $19.62/wk