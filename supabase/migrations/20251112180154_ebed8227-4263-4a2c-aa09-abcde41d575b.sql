-- Add VAT tracking fields to expenditures table
ALTER TABLE public.expenditures
ADD COLUMN subtotal numeric DEFAULT 0,
ADD COLUMN vat_amount numeric DEFAULT 0,
ADD COLUMN total numeric DEFAULT 0;

-- Update existing records to use current amount as total
UPDATE public.expenditures
SET subtotal = amount,
    vat_amount = 0,
    total = amount
WHERE subtotal IS NULL;

-- Add comment
COMMENT ON COLUMN public.expenditures.subtotal IS 'Expense amount before VAT';
COMMENT ON COLUMN public.expenditures.vat_amount IS 'VAT amount charged';
COMMENT ON COLUMN public.expenditures.total IS 'Total expense amount including VAT';