-- Fix the sales SELECT policy to use the has_role function for admin access
-- This ensures admins can see all sales regardless of department

-- Drop the old department-based policy
DROP POLICY IF EXISTS "Department-based sales access" ON public.sales;

-- Create new policy: Users see their own sales OR admins see all sales
CREATE POLICY "Users can view own sales or admins view all"
ON public.sales
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) 
  OR 
  has_role(auth.uid(), 'admin'::app_role)
);