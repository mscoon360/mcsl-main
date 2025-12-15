-- Add GL account number and credit balance to vendors table
ALTER TABLE public.vendors 
ADD COLUMN gl_account_number text,
ADD COLUMN credit_balance numeric DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.vendors.gl_account_number IS 'General Ledger account number for accounts payable';
COMMENT ON COLUMN public.vendors.credit_balance IS 'Credit balance from credit notes to be applied to future bills';