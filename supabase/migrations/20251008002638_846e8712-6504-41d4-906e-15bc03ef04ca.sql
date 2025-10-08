-- Fix RLS policies to separate READ access from WRITE access
-- This allows all authenticated users to view products/customers for creating sales
-- while maintaining proper write restrictions

-- ============================================
-- PRODUCTS TABLE: Allow all authenticated users to read
-- ============================================

-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own products or admins view all" ON public.products;

-- Create new read policy: All authenticated users can view all products
CREATE POLICY "Authenticated users can view all products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- Existing write policies remain (users can only modify their own products)


-- ============================================
-- CUSTOMERS TABLE: Allow all authenticated users to read
-- ============================================

-- Drop the overly restrictive SELECT policies for non-sales users
DROP POLICY IF EXISTS "Non-sales users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Sales users with active access can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Users with active access can view customers" ON public.customers;

-- Create new read policy: All authenticated users can view all customers
CREATE POLICY "Authenticated users can view all customers"
ON public.customers
FOR SELECT
TO authenticated
USING (true);

-- Existing write policies remain (users can only modify their own customers)