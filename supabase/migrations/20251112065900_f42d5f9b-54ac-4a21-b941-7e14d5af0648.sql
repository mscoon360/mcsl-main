-- Create promotions table for bundling products with optional discounts
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'none')),
  discount_value NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  bundle_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all promotions"
ON public.promotions FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert promotions"
ON public.promotions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own promotions"
ON public.promotions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own promotions"
ON public.promotions FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any promotions"
ON public.promotions FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();