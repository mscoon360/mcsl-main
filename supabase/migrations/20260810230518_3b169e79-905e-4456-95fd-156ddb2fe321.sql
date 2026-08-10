CREATE OR REPLACE FUNCTION public.rebuild_sale_ledger(p_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  it record;
  entries_json jsonb := '[]'::jsonb;
  vat numeric;
  revenue_total numeric;
  gross numeric;
  scale numeric;
  line_rev numeric;
  rev_acct text;
  cogs_acct text;
  inv_acct text;
  eff_product_id uuid;
  cogs_total numeric := 0;
  rev_sum numeric := 0;
  total_dr numeric;
  total_cr numeric;
  new_hash text;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND OR s.status <> 'completed' THEN
    RETURN;
  END IF;

  vat := COALESCE(s.vat_amount, 0);
  revenue_total := s.total - vat;

  SELECT COALESCE(SUM(price * quantity), 0) INTO gross FROM public.sale_items WHERE sale_id = p_sale_id;
  scale := CASE WHEN gross > 0 THEN revenue_total / gross ELSE 0 END;

  entries_json := entries_json || jsonb_build_object(
    'account_code', '1100_accounts_receivable',
    'debit', s.total, 'credit', 0, 'currency', 'USD',
    'memo', 'Sale to ' || s.customer_name || CASE WHEN vat > 0 THEN ' (including VAT)' ELSE '' END,
    'meta', jsonb_build_object('sale_id', s.id)
  );

  IF gross > 0 THEN
    FOR it IN
      SELECT si.*, si.price * si.quantity AS line_gross
      FROM public.sale_items si WHERE si.sale_id = p_sale_id
    LOOP
      eff_product_id := it.product_id;
      IF eff_product_id IS NULL THEN
        SELECT p.id INTO eff_product_id FROM public.products p
        WHERE lower(p.name) = lower(it.product_name) LIMIT 1;
      END IF;

      rev_acct := NULL; cogs_acct := NULL; inv_acct := NULL;
      IF eff_product_id IS NOT NULL THEN
        SELECT m.revenue_account_code, m.cogs_account_code, m.inventory_account_code
          INTO rev_acct, cogs_acct, inv_acct
        FROM public.product_account_mappings m
        WHERE m.product_id = eff_product_id
        ORDER BY (m.payment_term IS NOT DISTINCT FROM it.payment_period) DESC NULLS LAST,
                 (m.payment_term IS NULL) DESC
        LIMIT 1;
      END IF;

      line_rev := ROUND(it.line_gross * scale, 2);
      rev_sum := rev_sum + line_rev;

      IF line_rev <> 0 THEN
        entries_json := entries_json || jsonb_build_object(
          'account_code', COALESCE(rev_acct, '4000_sales_revenue'),
          'debit', 0, 'credit', line_rev, 'currency', 'USD',
          'memo', 'Revenue: ' || it.product_name || ' x' || it.quantity,
          'meta', jsonb_build_object('sale_id', s.id, 'sale_item_id', it.id, 'product_id', eff_product_id, 'product_name', it.product_name)
        );
      END IF;

      IF COALESCE(it.unit_cost, 0) > 0 THEN
        cogs_total := cogs_total + ROUND(it.unit_cost * it.quantity, 2);
        entries_json := entries_json || jsonb_build_object(
          'account_code', COALESCE(cogs_acct, '5000_cost_of_goods_sold'),
          'debit', ROUND(it.unit_cost * it.quantity, 2), 'credit', 0, 'currency', 'USD',
          'memo', 'Cost of sales: ' || it.product_name || ' x' || it.quantity,
          'meta', jsonb_build_object('sale_id', s.id, 'sale_item_id', it.id, 'product_id', eff_product_id, 'product_name', it.product_name)
        );
        entries_json := entries_json || jsonb_build_object(
          'account_code', COALESCE(inv_acct, '1001_inventory'),
          'debit', 0, 'credit', ROUND(it.unit_cost * it.quantity, 2), 'currency', 'USD',
          'memo', 'Inventory relief: ' || it.product_name || ' x' || it.quantity,
          'meta', jsonb_build_object('sale_id', s.id, 'sale_item_id', it.id, 'product_id', eff_product_id, 'product_name', it.product_name)
        );
      END IF;
    END LOOP;
  END IF;

  IF revenue_total - rev_sum <> 0 THEN
    entries_json := entries_json || jsonb_build_object(
      'account_code', '4000_sales_revenue',
      'debit', 0, 'credit', revenue_total - rev_sum, 'currency', 'USD',
      'memo', 'Unallocated revenue from sale ' || s.id::text,
      'meta', jsonb_build_object('sale_id', s.id)
    );
  END IF;

  IF vat > 0 THEN
    entries_json := entries_json || jsonb_build_object(
      'account_code', '2300_vat_payable',
      'debit', 0, 'credit', vat, 'currency', 'USD',
      'memo', 'Output VAT on sale ' || s.id::text,
      'meta', jsonb_build_object('sale_id', s.id, 'vat_rate', '12.5%')
    );
  END IF;

  total_dr := s.total + cogs_total;
  total_cr := s.total + cogs_total;
  new_hash := public.compute_balance_hash(entries_json);

  IF EXISTS (
    SELECT 1 FROM public.ledger_entries
    WHERE transaction_id = s.id::text AND source_type = 'sale'
      AND status = 'posted' AND balance_hash = new_hash
  ) THEN
    RETURN;
  END IF;

  UPDATE public.ledger_entries
  SET status = 'reversed',
      meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('reversed_at', now())
  WHERE transaction_id = s.id::text AND source_type = 'sale' AND status = 'posted';

  INSERT INTO public.ledger_entries (
    source_type, source_id, transaction_id, entries,
    total_debit, total_credit, balance_hash, user_id, status, posted_at
  ) VALUES (
    'sale', s.id::text, s.id::text, entries_json,
    total_dr, total_cr, new_hash, s.user_id, 'posted', s.date
  );
END;
$function$;