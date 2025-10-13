-- Drop all existing customer policies
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Sales users with access can view customers" ON public.customers;
DROP POLICY IF EXISTS "Sales users with access can update customers" ON public.customers;
DROP POLICY IF EXISTS "Sales users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Non-sales users can insert their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Default users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Default users can update customers" ON public.customers;

-- Create new policies: Default full access except for IT and Executive departments

-- Admins have full access
CREATE POLICY "Admins have full access to customers" ON public.customers
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- View policy: All departments except IT/Executive have access by default
CREATE POLICY "Non-restricted departments can view customers" ON public.customers
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.department NOT IN ('IT', 'Executive')
  )
  OR
  -- IT/Executive need approved access
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.department IN ('IT', 'Executive')
    )
    AND
    EXISTS (
      SELECT 1 FROM access_requests
      WHERE access_requests.user_id = auth.uid()
      AND access_requests.status = 'approved'
      AND access_requests.expires_at > now()
    )
  )
  OR
  -- Users can always see their own entries
  (auth.uid() = user_id)
);

-- Insert policy: All authenticated users can insert customers
CREATE POLICY "All users can insert customers" ON public.customers
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update policy: All departments except IT/Executive have access by default
CREATE POLICY "Non-restricted departments can update customers" ON public.customers
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.department NOT IN ('IT', 'Executive')
  )
  OR
  -- IT/Executive need approved access
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.department IN ('IT', 'Executive')
    )
    AND
    EXISTS (
      SELECT 1 FROM access_requests
      WHERE access_requests.user_id = auth.uid()
      AND access_requests.status = 'approved'
      AND access_requests.expires_at > now()
    )
  )
  OR
  -- Users can always update their own entries
  (auth.uid() = user_id)
);

-- Delete policy: Users can delete their own customers
CREATE POLICY "Users can delete their own customers" ON public.customers
FOR DELETE USING (auth.uid() = user_id);