-- Phase 1: Fix Critical RLS Policies

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view all sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can view all products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert invoice items" ON public.invoice_items;

-- Create secure customer policies (only own customers or admin)
CREATE POLICY "Users can view own customers or admins view all"
ON public.customers
FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create secure sales policies (only own sales or admin)
CREATE POLICY "Users can view own sales or admins view all"
ON public.sales
FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create secure product policies (only own products or admin)
CREATE POLICY "Users can view own products or admins view all"
ON public.products
FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Fix invoice items insert policy (verify ownership of parent invoice)
CREATE POLICY "Users can insert items to own invoices"
ON public.invoice_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.user_id = auth.uid()
  )
);