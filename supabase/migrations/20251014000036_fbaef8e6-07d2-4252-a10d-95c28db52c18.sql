-- Update sale_items policy to ensure sales reps can only view items from their own sales
DROP POLICY IF EXISTS "Authenticated users can view all sale items" ON public.sale_items;

CREATE POLICY "Users can view sale items from their own sales" ON public.sale_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
    AND sales.user_id = auth.uid()
  )
  OR 
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Finance department can see all
  EXISTS (
    SELECT 1 FROM department_visibility
    WHERE department_visibility.user_id = auth.uid()
    AND (department_visibility.department = 'Finance' OR department_visibility.department LIKE 'Finance-%')
  )
);