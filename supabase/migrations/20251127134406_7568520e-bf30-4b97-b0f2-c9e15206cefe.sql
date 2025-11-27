-- Add VAT tracking fields to accounts_payable
ALTER TABLE public.accounts_payable
ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0;

-- Add VAT tracking fields to accounts_receivable
ALTER TABLE public.accounts_receivable
ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0;

-- Update existing records to set subtotal = amount and vat_amount = 0 where null
UPDATE public.accounts_payable
SET subtotal = amount, vat_amount = 0
WHERE subtotal IS NULL;

UPDATE public.accounts_receivable
SET subtotal = amount, vat_amount = 0
WHERE subtotal IS NULL;