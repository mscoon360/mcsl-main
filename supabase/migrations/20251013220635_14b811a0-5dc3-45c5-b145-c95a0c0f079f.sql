-- Create supplies table for tracking non-product inventory items
CREATE TABLE public.supplies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT,
  category TEXT,
  last_restock_date DATE,
  min_stock_level INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in stock',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;

-- Create policies for supplies
CREATE POLICY "Authenticated users can view all supplies"
ON public.supplies
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert supplies"
ON public.supplies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplies"
ON public.supplies
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplies"
ON public.supplies
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any supplies"
ON public.supplies
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_supplies_updated_at
BEFORE UPDATE ON public.supplies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();