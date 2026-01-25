-- Create renewal_contracts table for imported renewal list data
CREATE TABLE public.renewal_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client TEXT NOT NULL,
  contract_start_date DATE,
  contract_end_date DATE,
  value_of_contract_vat NUMERIC DEFAULT 0,
  type_of_billing TEXT,
  billed BOOLEAN DEFAULT false,
  type_of_service TEXT,
  zone TEXT,
  contact_number TEXT,
  email TEXT,
  renewal_status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.renewal_contracts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all renewal contracts"
ON public.renewal_contracts
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own renewal contracts"
ON public.renewal_contracts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own renewal contracts"
ON public.renewal_contracts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any renewal contracts"
ON public.renewal_contracts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own renewal contracts"
ON public.renewal_contracts
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_renewal_contracts_updated_at
BEFORE UPDATE ON public.renewal_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();