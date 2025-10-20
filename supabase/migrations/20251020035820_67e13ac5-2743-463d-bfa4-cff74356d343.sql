-- Ensure pgcrypto functions are in public schema and re-define hashing safely
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
ALTER EXTENSION pgcrypto SET SCHEMA public;

-- Recreate compute_balance_hash using explicit schema and convert_to
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

  -- Use convert_to for reliable bytea conversion and schema-qualify digest
  RETURN encode(public.digest(convert_to(COALESCE(hash_input, ''), 'UTF8'), 'sha256'), 'hex');
END;
$$;