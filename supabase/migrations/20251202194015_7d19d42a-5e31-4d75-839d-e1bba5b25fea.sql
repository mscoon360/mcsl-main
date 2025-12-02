-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id),
  vendor_name text NOT NULL,
  order_number text NOT NULL,
  description text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  requested_by text,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_by uuid,
  rejected_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Policies for Procurement/Logistics to create and view their own orders
CREATE POLICY "Users can insert their own purchase orders"
ON public.purchase_orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all purchase orders"
ON public.purchase_orders
FOR SELECT
USING (true);

CREATE POLICY "Users can update their own pending purchase orders"
ON public.purchase_orders
FOR UPDATE
USING ((auth.uid() = user_id AND status = 'pending') OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM department_visibility
  WHERE department_visibility.user_id = auth.uid()
  AND (department_visibility.department = 'Finance' OR department_visibility.department LIKE 'Finance-%')
));

CREATE POLICY "Admins can delete purchase orders"
ON public.purchase_orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();