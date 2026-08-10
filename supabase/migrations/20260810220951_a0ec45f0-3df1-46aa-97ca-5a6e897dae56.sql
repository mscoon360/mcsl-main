CREATE TABLE public.product_account_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  revenue_account_code text,
  cogs_account_code text,
  inventory_account_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_account_mappings TO authenticated;
GRANT ALL ON public.product_account_mappings TO service_role;

ALTER TABLE public.product_account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own product account mappings"
ON public.product_account_mappings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and finance manage all product account mappings"
ON public.product_account_mappings
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.department ILIKE '%finance%'
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.department ILIKE '%finance%'
  )
);

CREATE TRIGGER update_product_account_mappings_updated_at
BEFORE UPDATE ON public.product_account_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_product_account_mappings_product ON public.product_account_mappings(product_id);