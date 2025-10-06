-- Phase 1: Fix Critical RLS Policies

-- ============================================
-- CUSTOMERS TABLE - Restrict data access
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update all customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete all customers" ON public.customers;

-- Create restrictive policies - users can only access their own customers
CREATE POLICY "Users can view their own customers"
ON public.customers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all customers"
ON public.customers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own customers"
ON public.customers
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own customers"
ON public.customers
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- SALES TABLE - Prevent tampering
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update all sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can delete all sales" ON public.sales;

CREATE POLICY "Users can update their own sales"
ON public.sales
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales"
ON public.sales
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any sales"
ON public.sales
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- EXPENDITURES TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update all expenditures" ON public.expenditures;
DROP POLICY IF EXISTS "Authenticated users can delete all expenditures" ON public.expenditures;

CREATE POLICY "Users can update their own expenditures"
ON public.expenditures
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenditures"
ON public.expenditures
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any expenditures"
ON public.expenditures
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- INVOICES TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can delete all invoices" ON public.invoices;

CREATE POLICY "Users can update their own invoices"
ON public.invoices
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices"
ON public.invoices
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any invoices"
ON public.invoices
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- PRODUCTS TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update all products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete all products" ON public.products;

CREATE POLICY "Users can update their own products"
ON public.products
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
ON public.products
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any products"
ON public.products
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- PAYMENT SCHEDULES TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update all payment schedules" ON public.payment_schedules;
DROP POLICY IF EXISTS "Authenticated users can delete all payment schedules" ON public.payment_schedules;

CREATE POLICY "Users can update their own payment schedules"
ON public.payment_schedules
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment schedules"
ON public.payment_schedules
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any payment schedules"
ON public.payment_schedules
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- FULFILLMENT ITEMS TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update all fulfillment items" ON public.fulfillment_items;
DROP POLICY IF EXISTS "Authenticated users can delete all fulfillment items" ON public.fulfillment_items;

CREATE POLICY "Users can update their own fulfillment items"
ON public.fulfillment_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fulfillment items"
ON public.fulfillment_items
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any fulfillment items"
ON public.fulfillment_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- INVOICE ITEMS TABLE - Secure via parent invoice
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update all invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users can delete all invoice items" ON public.invoice_items;

CREATE POLICY "Users can update their own invoice items"
ON public.invoice_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own invoice items"
ON public.invoice_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete any invoice items"
ON public.invoice_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- SALE ITEMS TABLE - Secure via parent sale
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update all sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can delete all sale items" ON public.sale_items;

CREATE POLICY "Users can update their own sale items"
ON public.sale_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
    AND sales.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own sale items"
ON public.sale_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
    AND sales.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete any sale items"
ON public.sale_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));