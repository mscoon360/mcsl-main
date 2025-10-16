-- Create vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  contact_person TEXT,
  payment_terms TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create accounts_payable table (bills to pay)
CREATE TABLE public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  description TEXT,
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create accounts_receivable table (invoices to collect)
CREATE TABLE public.accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  description TEXT,
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendors
CREATE POLICY "Authenticated users can view all vendors"
  ON public.vendors FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert vendors"
  ON public.vendors FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vendors"
  ON public.vendors FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vendors"
  ON public.vendors FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any vendors"
  ON public.vendors FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for accounts_payable
CREATE POLICY "Authenticated users can view all AP"
  ON public.accounts_payable FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert AP"
  ON public.accounts_payable FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AP"
  ON public.accounts_payable FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AP"
  ON public.accounts_payable FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any AP"
  ON public.accounts_payable FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for accounts_receivable
CREATE POLICY "Authenticated users can view all AR"
  ON public.accounts_receivable FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert AR"
  ON public.accounts_receivable FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AR"
  ON public.accounts_receivable FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AR"
  ON public.accounts_receivable FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any AR"
  ON public.accounts_receivable FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_payable_updated_at
  BEFORE UPDATE ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_receivable_updated_at
  BEFORE UPDATE ON public.accounts_receivable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();