-- Fix function search path security warnings
DROP FUNCTION IF EXISTS public.validate_ledger_balance() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_ledger_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if debits equal credits
  IF NEW.total_debit != NEW.total_credit THEN
    RAISE EXCEPTION 'Ledger entry out of balance: debits=% credits=%', NEW.total_debit, NEW.total_credit;
  END IF;
  
  -- Compute balance hash if not provided
  IF NEW.balance_hash IS NULL OR NEW.balance_hash = '' THEN
    NEW.balance_hash := public.compute_balance_hash(NEW.entries);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER validate_ledger_balance_trigger
  BEFORE INSERT OR UPDATE ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ledger_balance();

-- Fix compute_balance_hash function
DROP FUNCTION IF EXISTS public.compute_balance_hash(jsonb);

CREATE OR REPLACE FUNCTION public.compute_balance_hash(entries jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hash_input text;
BEGIN
  SELECT string_agg(
    format('%s:%s:%s', 
      entry->>'account_code',
      COALESCE(entry->>'debit', '0'),
      COALESCE(entry->>'credit', '0')
    ),
    '|'
    ORDER BY entry->>'account_code'
  ) INTO hash_input
  FROM jsonb_array_elements(entries) AS entry;
  
  RETURN encode(digest(hash_input, 'sha256'), 'hex');
END;
$$;