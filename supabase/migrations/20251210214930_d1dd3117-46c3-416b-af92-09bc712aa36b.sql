-- Create table to store product supporting relationships
CREATE TABLE public.product_supporting_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supporting_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, supporting_product_id)
);

-- Enable RLS
ALTER TABLE public.product_supporting_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all supporting items"
ON public.product_supporting_items
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own supporting items"
ON public.product_supporting_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supporting items"
ON public.product_supporting_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supporting items"
ON public.product_supporting_items
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any supporting items"
ON public.product_supporting_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_product_supporting_items_updated_at
BEFORE UPDATE ON public.product_supporting_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();