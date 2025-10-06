-- Drop existing restrictive RLS policies and create company-wide policies
-- This allows all authenticated users to see data from all employees

-- Customers table
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON public.customers;

CREATE POLICY "Authenticated users can view all customers"
ON public.customers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert customers"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all customers"
ON public.customers FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all customers"
ON public.customers FOR DELETE
TO authenticated
USING (true);

-- Products table
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;

CREATE POLICY "Authenticated users can view all products"
ON public.products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all products"
ON public.products FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all products"
ON public.products FOR DELETE
TO authenticated
USING (true);

-- Sales table
DROP POLICY IF EXISTS "Users can view their own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can insert their own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can update their own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can delete their own sales" ON public.sales;

CREATE POLICY "Authenticated users can view all sales"
ON public.sales FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert sales"
ON public.sales FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all sales"
ON public.sales FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all sales"
ON public.sales FOR DELETE
TO authenticated
USING (true);

-- Sale items table
DROP POLICY IF EXISTS "Users can view their own sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can insert their own sale items" ON public.sale_items;

CREATE POLICY "Authenticated users can view all sale items"
ON public.sale_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert sale items"
ON public.sale_items FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all sale items"
ON public.sale_items FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all sale items"
ON public.sale_items FOR DELETE
TO authenticated
USING (true);

-- Invoices table
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;

CREATE POLICY "Authenticated users can view all invoices"
ON public.invoices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert invoices"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all invoices"
ON public.invoices FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all invoices"
ON public.invoices FOR DELETE
TO authenticated
USING (true);

-- Invoice items table
DROP POLICY IF EXISTS "Users can view their own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert their own invoice items" ON public.invoice_items;

CREATE POLICY "Authenticated users can view all invoice items"
ON public.invoice_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert invoice items"
ON public.invoice_items FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all invoice items"
ON public.invoice_items FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all invoice items"
ON public.invoice_items FOR DELETE
TO authenticated
USING (true);

-- Expenditures table
DROP POLICY IF EXISTS "Users can view their own expenditures" ON public.expenditures;
DROP POLICY IF EXISTS "Users can insert their own expenditures" ON public.expenditures;
DROP POLICY IF EXISTS "Users can update their own expenditures" ON public.expenditures;
DROP POLICY IF EXISTS "Users can delete their own expenditures" ON public.expenditures;

CREATE POLICY "Authenticated users can view all expenditures"
ON public.expenditures FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert expenditures"
ON public.expenditures FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all expenditures"
ON public.expenditures FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all expenditures"
ON public.expenditures FOR DELETE
TO authenticated
USING (true);

-- Fulfillment items table
DROP POLICY IF EXISTS "Users can view their own fulfillment items" ON public.fulfillment_items;
DROP POLICY IF EXISTS "Users can insert their own fulfillment items" ON public.fulfillment_items;
DROP POLICY IF EXISTS "Users can update their own fulfillment items" ON public.fulfillment_items;
DROP POLICY IF EXISTS "Users can delete their own fulfillment items" ON public.fulfillment_items;

CREATE POLICY "Authenticated users can view all fulfillment items"
ON public.fulfillment_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert fulfillment items"
ON public.fulfillment_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all fulfillment items"
ON public.fulfillment_items FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all fulfillment items"
ON public.fulfillment_items FOR DELETE
TO authenticated
USING (true);

-- Payment schedules table
DROP POLICY IF EXISTS "Users can view their own payment schedules" ON public.payment_schedules;
DROP POLICY IF EXISTS "Users can insert their own payment schedules" ON public.payment_schedules;
DROP POLICY IF EXISTS "Users can update their own payment schedules" ON public.payment_schedules;
DROP POLICY IF EXISTS "Users can delete their own payment schedules" ON public.payment_schedules;

CREATE POLICY "Authenticated users can view all payment schedules"
ON public.payment_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert payment schedules"
ON public.payment_schedules FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all payment schedules"
ON public.payment_schedules FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all payment schedules"
ON public.payment_schedules FOR DELETE
TO authenticated
USING (true);

-- Enable realtime for all tables so changes sync across users
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenditures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fulfillment_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_schedules;