-- Drop the existing restrictive policy for product updates
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;

-- Create a new policy that allows:
-- 1. Product owners to update their own products
-- 2. Admins to update any product
-- 3. Users with department visibility access to update products
CREATE POLICY "Users can update products with proper access"
ON public.products
FOR UPDATE
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1
    FROM public.department_visibility
    WHERE department_visibility.user_id = auth.uid()
  )
);