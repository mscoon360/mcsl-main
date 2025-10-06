-- Update RLS policy to use 'finance department' instead of 'accounting'
DROP POLICY IF EXISTS "Department-based sales access" ON public.sales;

CREATE POLICY "Department-based sales access"
ON public.sales
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  (EXISTS ( 
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.department = ANY (ARRAY['admin'::text, 'finance department'::text, 'operations'::text])
  ))
);

-- Update existing profiles with 'accounting' department to 'finance department'
UPDATE public.profiles
SET department = 'finance department'
WHERE department = 'accounting';