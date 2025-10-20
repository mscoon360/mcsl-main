-- Fix the digest function with proper type casting for both parameters
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
  
  -- Fix: Cast both parameters explicitly - text to bytea and algorithm to text
  RETURN encode(digest(hash_input::bytea, 'sha256'::text), 'hex');
END;
$$;