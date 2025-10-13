-- Drop all existing customer policies
DROP POLICY IF EXISTS "Admins have full access to customers" ON public.customers;
DROP POLICY IF EXISTS "Non-restricted departments can view customers" ON public.customers;
DROP POLICY IF EXISTS "All users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Non-restricted departments can update customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON public.customers;

-- Create new policies: Only IT and Executive have default access, everyone else needs approval

-- Admins have full access
CREATE POLICY "Admins have full access to customers" ON public.customers
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- View policy: IT/Executive have default access, others need approved access
CREATE POLICY "Restricted database view access" ON public.customers
FOR SELECT USING (
  -- IT and Executive have default access
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.department IN ('IT', 'Executive')
  )
  OR
  -- All other departments need approved access
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.department NOT IN ('IT', 'Executive')
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

-- Update policy: IT/Executive have default access, others need approved access
CREATE POLICY "Restricted database update access" ON public.customers
FOR UPDATE USING (
  -- IT and Executive have default access
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.department IN ('IT', 'Executive')
  )
  OR
  -- All other departments need approved access
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.department NOT IN ('IT', 'Executive')
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