-- Drop existing problematic policies
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Sales users with active access can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Users with active access can insert customers" ON public.customers;

-- Sales users can always INSERT new customers (no access needed)
CREATE POLICY "Sales users can insert customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (
  (auth.uid() = user_id) AND 
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.department = 'sales'
  ))
);

-- Sales users need active access to view customers
CREATE POLICY "Sales users with access can view customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (
  -- Admins can view all
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Non-sales users can view all
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.department != 'sales'
  )) OR
  -- Sales users with approved, non-expired access can view
  (
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.department = 'sales'
    )) AND
    (EXISTS (
      SELECT 1 FROM access_requests 
      WHERE access_requests.user_id = auth.uid() 
      AND access_requests.status = 'approved' 
      AND access_requests.expires_at > now()
    ))
  )
);

-- Sales users need active access to update customers
CREATE POLICY "Sales users with access can update customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (
  (auth.uid() = user_id) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.department != 'sales'
    )) OR
    (
      (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.department = 'sales'
      )) AND
      (EXISTS (
        SELECT 1 FROM access_requests 
        WHERE access_requests.user_id = auth.uid() 
        AND access_requests.status = 'approved' 
        AND access_requests.expires_at > now()
      ))
    )
  )
);