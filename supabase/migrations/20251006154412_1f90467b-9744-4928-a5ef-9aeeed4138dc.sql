-- Drop the conflicting policies that allow all users to view their own customers
DROP POLICY IF EXISTS "Users can view own customers or admins view all" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;

-- Create new policies that check department
-- Non-sales users can view and manage their own customers
CREATE POLICY "Non-sales users can view their own customers"
ON public.customers FOR SELECT
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.department != 'sales'
  )
);

CREATE POLICY "Non-sales users can insert their own customers"
ON public.customers FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.department != 'sales'
  )
);

-- Sales users need active access to view customers
CREATE POLICY "Sales users with active access can view all customers"
ON public.customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.department = 'sales'
  )
  AND EXISTS (
    SELECT 1 FROM public.access_requests
    WHERE access_requests.user_id = auth.uid()
    AND access_requests.status = 'approved'
    AND access_requests.expires_at > now()
  )
);

-- Sales users with active access can insert customers
CREATE POLICY "Sales users with active access can insert customers"
ON public.customers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.department = 'sales'
  )
  AND EXISTS (
    SELECT 1 FROM public.access_requests
    WHERE access_requests.user_id = auth.uid()
    AND access_requests.status = 'approved'
    AND access_requests.expires_at > now()
  )
);