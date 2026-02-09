-- Allow admins to update rental payment terms
CREATE POLICY "Admins can update rental payment terms"
ON public.rental_payment_terms
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete rental payment terms
CREATE POLICY "Admins can delete rental payment terms"
ON public.rental_payment_terms
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow finance users to update rental payment terms
CREATE POLICY "Finance users can update rental payment terms"
ON public.rental_payment_terms
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM department_visibility
  WHERE department_visibility.user_id = auth.uid()
  AND (department_visibility.department = 'Finance' OR department_visibility.department LIKE 'Finance-%')
));

-- Same for products table - allow finance users to update
CREATE POLICY "Finance users can update products"
ON public.products
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM department_visibility
  WHERE department_visibility.user_id = auth.uid()
  AND (department_visibility.department = 'Finance' OR department_visibility.department LIKE 'Finance-%')
));

-- Same for rental_payment_term_expenses
CREATE POLICY "Admins can update rental payment term expenses"
ON public.rental_payment_term_expenses
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance users can update rental payment term expenses"
ON public.rental_payment_term_expenses
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM department_visibility
  WHERE department_visibility.user_id = auth.uid()
  AND (department_visibility.department = 'Finance' OR department_visibility.department LIKE 'Finance-%')
));