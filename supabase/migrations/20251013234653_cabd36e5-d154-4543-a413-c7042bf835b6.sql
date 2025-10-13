-- Drop existing customer access policies
DROP POLICY IF EXISTS "Sales users with access can view customers" ON public.customers;
DROP POLICY IF EXISTS "Sales users with access can update customers" ON public.customers;
DROP POLICY IF EXISTS "Sales users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Non-sales users can insert their own customers" ON public.customers;

-- Create new policies: Default full access except for IT and Executive departments
-- IT and Executive need approved access requests to view/modify customers

-- View policy: Everyone except IT/Executive can view, IT/Executive need approval
CREATE POLICY "Default users can view customers" ON public.customers
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  (auth.uid() = user_id)
  OR
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.department NOT IN ('IT', 'Executive')
    )
  )
  OR
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
);

-- Insert policy: All authenticated users can insert their own customers
CREATE POLICY "Users can insert customers" ON public.customers
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update policy: Everyone except IT/Executive can update, IT/Executive need approval
CREATE POLICY "Default users can update customers" ON public.customers
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR
  (auth.uid() = user_id)
  OR
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.department NOT IN ('IT', 'Executive')
    )
  )
  OR
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
);