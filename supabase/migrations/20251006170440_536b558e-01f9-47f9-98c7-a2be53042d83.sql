-- Create product_items table to store individual units with barcodes
CREATE TABLE public.product_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'available',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own product items"
ON public.product_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_items.product_id
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all product items"
ON public.product_items
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own product items"
ON public.product_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_items.product_id
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own product items"
ON public.product_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_items.product_id
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own product items"
ON public.product_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_items.product_id
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all product items"
ON public.product_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_product_items_product_id ON public.product_items(product_id);
CREATE INDEX idx_product_items_barcode ON public.product_items(barcode);

-- Add trigger for updated_at
CREATE TRIGGER update_product_items_updated_at
BEFORE UPDATE ON public.product_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();