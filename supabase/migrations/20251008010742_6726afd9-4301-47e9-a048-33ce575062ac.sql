-- Update sales RLS policy to allow finance users to view all sales
DROP POLICY IF EXISTS "Users can view own sales or admins view all" ON public.sales;

CREATE POLICY "Users can view own sales, admins, or finance users view all"
ON public.sales
FOR SELECT
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM department_visibility 
    WHERE user_id = auth.uid() 
    AND (department = 'Finance' OR department LIKE 'Finance-%')
  )
);