-- Create access requests table
CREATE TABLE public.access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create customer activity log table
CREATE TABLE public.customer_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  changes jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for access_requests
CREATE POLICY "Users can view their own access requests"
ON public.access_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own access requests"
ON public.access_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all access requests"
ON public.access_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update access requests"
ON public.access_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for customer_activity_log
CREATE POLICY "Admins can view all activity logs"
ON public.customer_activity_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own activity logs"
ON public.customer_activity_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update customers table RLS to allow access for approved requests
CREATE POLICY "Users with active access can view customers"
ON public.customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.access_requests
    WHERE access_requests.user_id = auth.uid()
      AND access_requests.status = 'approved'
      AND access_requests.expires_at > now()
  )
);

CREATE POLICY "Users with active access can insert customers"
ON public.customers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.access_requests
    WHERE access_requests.user_id = auth.uid()
      AND access_requests.status = 'approved'
      AND access_requests.expires_at > now()
  )
);

-- Add trigger for updated_at on access_requests
CREATE TRIGGER update_access_requests_updated_at
BEFORE UPDATE ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();