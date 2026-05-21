
-- Divisions: allow admins and Finance to update/insert/delete any
CREATE POLICY "Admins can update any divisions" ON public.divisions
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can update any divisions" ON public.divisions
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM public.department_visibility
  WHERE user_id = auth.uid()
    AND (department = 'Finance' OR department LIKE 'Finance-%')
));

-- Subdivisions: same elevated permissions
CREATE POLICY "Admins can update any subdivisions" ON public.subdivisions
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can update any subdivisions" ON public.subdivisions
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM public.department_visibility
  WHERE user_id = auth.uid()
    AND (department = 'Finance' OR department LIKE 'Finance-%')
));

CREATE POLICY "Admins can insert any subdivisions" ON public.subdivisions
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can insert any subdivisions" ON public.subdivisions
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.department_visibility
  WHERE user_id = auth.uid()
    AND (department = 'Finance' OR department LIKE 'Finance-%')
));

CREATE POLICY "Admins can delete any subdivisions too" ON public.subdivisions
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can delete any subdivisions" ON public.subdivisions
FOR DELETE USING (EXISTS (
  SELECT 1 FROM public.department_visibility
  WHERE user_id = auth.uid()
    AND (department = 'Finance' OR department LIKE 'Finance-%')
));
