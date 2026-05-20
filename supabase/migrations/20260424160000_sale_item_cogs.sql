-- Wire actual COGS postings on sales.
--
-- For every sale_item we now know:
--   - which product (product_id)
--   - what it cost us per unit (unit_cost)
-- so we can post a per-item double-entry:
--   DR product's COGS account  (from chart_of_accounts.product_id link)
--   CR Inventory account       (configurable via account_mappings, falls back
--                               to '1001_inventory')
-- The parent sale's AR / Revenue / VAT posting is unchanged.

-- 1. Extend sale_items
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_id uuid
    REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_cost numeric;

CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- 2. Backfill product_id and unit_cost on existing rows where the link is
--    unambiguous (single product with the same name belonging to the sale's
--    user). Leave anything ambiguous alone.
UPDATE public.sale_items si
SET product_id = sub.product_id,
    unit_cost  = COALESCE(si.unit_cost, sub.cost_price)
FROM (
  SELECT si2.id AS sale_item_id,
         p.id  AS product_id,
         p.cost_price
  FROM public.sale_items si2
  JOIN public.sales s ON s.id = si2.sale_id
  JOIN public.products p ON p.user_id = s.user_id AND p.name = si2.product_name
  WHERE si2.product_id IS NULL
  GROUP BY si2.id, p.id, p.cost_price
  HAVING COUNT(*) = 1   -- single match only
) AS sub
WHERE si.id = sub.sale_item_id;

-- 3. Worker function: post (or refresh) the COGS journal for one sale_item.
CREATE OR REPLACE FUNCTION public.post_cogs_entry_for_sale_item(p_item public.sale_items)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_sale_status text;
  v_cogs_account text;
  v_inventory_account text;
  v_cogs_amount numeric;
  v_existing_entry_id uuid;
  v_new_balance_hash text;
  v_entries_json jsonb;
  v_product_name text;
BEGIN
  -- Nothing to post without a product link or a positive unit cost.
  IF p_item.product_id IS NULL OR COALESCE(p_item.unit_cost, 0) <= 0 THEN
    RETURN;
  END IF;

  SELECT user_id, status INTO v_user_id, v_sale_status
  FROM public.sales WHERE id = p_item.sale_id;

  IF v_sale_status IS DISTINCT FROM 'completed' THEN
    RETURN;
  END IF;

  -- The product's COGS account is whichever chart_of_accounts row is linked
  -- to it (created by sync_product_cogs_account).
  SELECT account_number INTO v_cogs_account
  FROM public.chart_of_accounts
  WHERE user_id = v_user_id AND product_id = p_item.product_id;

  IF v_cogs_account IS NULL THEN
    -- No COGS account exists (e.g. product was deleted); skip rather than
    -- posting to an invented code.
    RETURN;
  END IF;

  v_inventory_account := public.get_mapped_account(v_user_id, 'sale', 'inventory', '1001_inventory');
  v_cogs_amount := p_item.unit_cost * p_item.quantity;
  v_product_name := COALESCE(p_item.product_name, 'product');

  v_entries_json := jsonb_build_array(
    jsonb_build_object(
      'account_code', v_cogs_account,
      'debit',  v_cogs_amount,
      'credit', 0,
      'currency', 'USD',
      'memo', 'COGS for ' || v_product_name || ' (qty ' || p_item.quantity || ')',
      'meta', jsonb_build_object(
        'sale_id', p_item.sale_id,
        'sale_item_id', p_item.id,
        'product_id', p_item.product_id,
        'is_rental', COALESCE(p_item.is_rental, false)
      )
    ),
    jsonb_build_object(
      'account_code', v_inventory_account,
      'debit', 0,
      'credit', v_cogs_amount,
      'currency', 'USD',
      'memo', 'Inventory release for ' || v_product_name,
      'meta', jsonb_build_object(
        'sale_id', p_item.sale_id,
        'sale_item_id', p_item.id,
        'product_id', p_item.product_id
      )
    )
  );

  v_new_balance_hash := public.compute_balance_hash(v_entries_json);

  -- Idempotency: one COGS ledger entry per sale_item, keyed by meta.sale_item_id.
  SELECT id INTO v_existing_entry_id
  FROM public.ledger_entries
  WHERE source_type = 'sale'
    AND source_id = p_item.sale_id::text
    AND meta->>'sale_item_id' = p_item.id::text
    AND meta->>'is_cogs' = 'true'
  LIMIT 1;

  IF v_existing_entry_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ledger_entries
      WHERE id = v_existing_entry_id AND balance_hash = v_new_balance_hash
    ) THEN
      RETURN;
    ELSE
      UPDATE public.ledger_entries
      SET status = 'reversed',
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('reversed_at', now())
      WHERE id = v_existing_entry_id;
    END IF;
  END IF;

  INSERT INTO public.ledger_entries (
    source_type, source_id, transaction_id, entries,
    total_debit, total_credit, balance_hash, user_id, status, meta
  ) VALUES (
    'sale',
    p_item.sale_id::text,
    p_item.id::text,
    v_entries_json,
    v_cogs_amount,
    v_cogs_amount,
    v_new_balance_hash,
    v_user_id,
    'posted',
    jsonb_build_object(
      'is_cogs', true,
      'sale_id', p_item.sale_id,
      'sale_item_id', p_item.id,
      'product_id', p_item.product_id
    )
  );
END;
$$;

-- 4. Trigger wrapper that fires on sale_items.
CREATE OR REPLACE FUNCTION public.trg_cogs_on_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.post_cogs_entry_for_sale_item(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_cogs_entry_on_sale_item ON public.sale_items;
CREATE TRIGGER create_cogs_entry_on_sale_item
  AFTER INSERT OR UPDATE ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cogs_on_sale_item();

-- 5. Backfill COGS journals for sale_items that just got product_id / unit_cost
--    populated by step 2.
DO $$
DECLARE
  r public.sale_items;
BEGIN
  FOR r IN
    SELECT si.*
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.product_id IS NOT NULL
      AND COALESCE(si.unit_cost, 0) > 0
      AND s.status = 'completed'
  LOOP
    PERFORM public.post_cogs_entry_for_sale_item(r);
  END LOOP;
END $$;
