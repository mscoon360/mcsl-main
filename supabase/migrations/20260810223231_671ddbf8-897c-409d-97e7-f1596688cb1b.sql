ALTER TABLE public.product_account_mappings ADD COLUMN IF NOT EXISTS payment_term text;

ALTER TABLE public.product_account_mappings DROP CONSTRAINT IF EXISTS product_account_mappings_user_id_product_id_key;

DROP INDEX IF EXISTS product_account_mappings_user_product_term_idx;

CREATE UNIQUE INDEX product_account_mappings_user_product_term_idx
  ON public.product_account_mappings (user_id, product_id, COALESCE(payment_term, ''));