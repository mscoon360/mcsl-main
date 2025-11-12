-- Add promotion reference to sales table
ALTER TABLE public.sales
ADD COLUMN promotion_id UUID REFERENCES public.promotions(id);

-- Add promotion discount info to sale_items
ALTER TABLE public.sale_items
ADD COLUMN item_discount_type TEXT CHECK (item_discount_type IN ('percentage', 'fixed', 'none')),
ADD COLUMN item_discount_value NUMERIC DEFAULT 0;