-- Auto-create and maintain a COGS account in chart_of_accounts for every product.
-- The account is named after the product and carries a cogs_kind tag of
-- 'sale', 'rental', or 'both' derived from the product's is_rental flags.

-- 1. Extend chart_of_accounts with a product link + COGS kind.
ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS product_id uuid
    REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cogs_kind text
    CHECK (cogs_kind IN ('sale', 'rental', 'both'));

-- One COGS account per (user, product) at most.
CREATE UNIQUE INDEX IF NOT EXISTS chart_of_accounts_product_unique
  ON public.chart_of_accounts (user_id, product_id)
  WHERE product_id IS NOT NULL;

-- 2. Helper: derive the COGS kind from a product row.
CREATE OR REPLACE FUNCTION public.product_cogs_kind(p_is_rental boolean, p_is_rental_only boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_is_rental_only, false) THEN 'rental'
    WHEN COALESCE(p_is_rental, false)      THEN 'both'
    ELSE                                        'sale'
  END;
$$;

-- 3. Sync one product's COGS account: create on first run, update otherwise.
CREATE OR REPLACE FUNCTION public.sync_product_cogs_account(p_product public.products)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_existing_id uuid;
  v_account_number text;
  v_sku_slug text;
  v_uuid_slug text;
  v_suffix int := 0;
BEGIN
  v_kind := public.product_cogs_kind(p_product.is_rental, p_product.is_rental_only);

  SELECT id INTO v_existing_id
  FROM public.chart_of_accounts
  WHERE user_id = p_product.user_id AND product_id = p_product.id;

  IF v_existing_id IS NOT NULL THEN
    -- Existing account: refresh the name, kind and active flag. Leave the
    -- account_number alone so users keep any code they may have edited.
    UPDATE public.chart_of_accounts
    SET account_name = p_product.name,
        cogs_kind    = v_kind,
        is_active    = (COALESCE(p_product.status, 'active') = 'active')
    WHERE id = v_existing_id;
    RETURN;
  END IF;

  -- Build a deterministic account number from the SKU; fall back to the
  -- product UUID when SKU is empty or sanitises away to nothing.
  v_sku_slug := lower(regexp_replace(COALESCE(p_product.sku, ''), '[^a-zA-Z0-9]+', '_', 'g'));
  v_sku_slug := trim(both '_' from v_sku_slug);
  v_uuid_slug := left(replace(p_product.id::text, '-', ''), 8);

  IF v_sku_slug = '' THEN
    v_account_number := '6000-' || v_uuid_slug;
  ELSE
    v_account_number := '6000-' || v_sku_slug;
  END IF;

  -- Resolve any collision against an existing user-defined code by appending
  -- the uuid slug then a numeric suffix.
  WHILE EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE user_id = p_product.user_id AND account_number = v_account_number
  ) LOOP
    v_suffix := v_suffix + 1;
    v_account_number := '6000-' || COALESCE(NULLIF(v_sku_slug, ''), v_uuid_slug)
      || '-' || v_uuid_slug
      || CASE WHEN v_suffix > 1 THEN '-' || v_suffix::text ELSE '' END;
  END LOOP;

  INSERT INTO public.chart_of_accounts (
    user_id, account_number, account_name, account_type, account_subtype,
    description, is_active, balance, product_id, cogs_kind
  ) VALUES (
    p_product.user_id,
    v_account_number,
    p_product.name,
    'expense',
    'cost-of-goods-sold',
    'Auto-generated COGS account for product: ' || p_product.name,
    (COALESCE(p_product.status, 'active') = 'active'),
    0,
    p_product.id,
    v_kind
  );
END;
$$;

-- 4. Trigger function: route products INSERT/UPDATE/DELETE to the sync helper.
CREATE OR REPLACE FUNCTION public.trg_sync_product_cogs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- The chart_of_accounts.product_id FK is ON DELETE SET NULL, so the link
    -- is cleared automatically. Mark the account inactive so it stops
    -- appearing as an option in the COGS picker but stays for ledger history.
    UPDATE public.chart_of_accounts
    SET is_active = false
    WHERE user_id = OLD.user_id AND product_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Skip the sync if nothing the account depends on has actually changed.
    IF NEW.name             IS NOT DISTINCT FROM OLD.name
       AND NEW.sku          IS NOT DISTINCT FROM OLD.sku
       AND NEW.is_rental    IS NOT DISTINCT FROM OLD.is_rental
       AND NEW.is_rental_only IS NOT DISTINCT FROM OLD.is_rental_only
       AND NEW.status       IS NOT DISTINCT FROM OLD.status
    THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.sync_product_cogs_account(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_product_cogs_account_trigger ON public.products;
CREATE TRIGGER sync_product_cogs_account_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_product_cogs();

-- 5. Backfill: sync every product that doesn't yet have a COGS account.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT * FROM public.products LOOP
    PERFORM public.sync_product_cogs_account(p);
  END LOOP;
END $$;
