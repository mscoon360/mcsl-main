-- Drop existing sales SELECT policy
DROP POLICY IF EXISTS "Users can view own sales or admins view all" ON public.sales;

-- Create new RLS policy for sales viewing based on department
-- Sales users see only their own sales
-- Admin, accounting, and operations see all sales
CREATE POLICY "Department-based sales access"
ON public.sales
FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.department IN ('admin', 'accounting', 'operations')
  )
);