-- Account mappings: let each user choose which CoA account fills each
-- posting role (e.g. "sales revenue", "input VAT", "AR settlement").
-- The sale / expense / payment ledger triggers consult this table and fall
-- back to the previously hard-coded codes when no mapping exists, so
-- existing behaviour is preserved.

-- 1. Mapping table
CREATE TABLE IF NOT EXISTS public.account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workflow text NOT NULL CHECK (workflow IN ('sale', 'expense', 'payment', 'refund')),
  role text NOT NULL,
  account_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, workflow, role)
);

CREATE INDEX IF NOT EXISTS idx_account_mappings_lookup
  ON public.account_mappings (user_id, workflow, role);

ALTER TABLE public.account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mappings"   ON public.account_mappings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own mappings" ON public.account_mappings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own mappings" ON public.account_mappings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own mappings" ON public.account_mappings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_account_mappings_updated_at
  BEFORE UPDATE ON public.account_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Lookup helper: returns the user's mapped account_code for (workflow, role),
--    or p_fallback if no mapping exists. STABLE so it's safe inside triggers.
CREATE OR REPLACE FUNCTION public.get_mapped_account(
  p_user_id uuid,
  p_workflow text,
  p_role text,
  p_fallback text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT account_code FROM public.account_mappings
       WHERE user_id = p_user_id
         AND workflow = p_workflow
         AND role = p_role
       LIMIT 1),
    p_fallback
  );
$$;

-- 3. Updated sale trigger -- looks up mappings, falls back to existing codes.
CREATE OR REPLACE FUNCTION public.create_ledger_entry_from_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_entry_id uuid;
  new_balance_hash text;
  entries_json jsonb;
  total_debit_val numeric;
  total_credit_val numeric;
  vat_amount numeric;
  revenue_amount numeric;
  ar_acct text;
  rev_acct text;
  vat_acct text;
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  ar_acct  := public.get_mapped_account(NEW.user_id, 'sale', 'accounts_receivable', '1100_accounts_receivable');
  rev_acct := public.get_mapped_account(NEW.user_id, 'sale', 'sales_revenue',       '4000_sales_revenue');
  vat_acct := public.get_mapped_account(NEW.user_id, 'sale', 'output_vat',          '2300_vat_payable');

  vat_amount     := COALESCE(NEW.vat_amount, 0);
  revenue_amount := NEW.total - vat_amount;

  IF vat_amount > 0 THEN
    entries_json := jsonb_build_array(
      jsonb_build_object('account_code', ar_acct,  'debit', NEW.total,       'credit', 0,
        'currency', 'USD', 'memo', 'Sale to ' || NEW.customer_name || ' (including VAT)',
        'meta', jsonb_build_object('sale_id', NEW.id)),
      jsonb_build_object('account_code', rev_acct, 'debit', 0,               'credit', revenue_amount,
        'currency', 'USD', 'memo', 'Revenue from sale ' || NEW.id::text,
        'meta', jsonb_build_object('sale_id', NEW.id)),
      jsonb_build_object('account_code', vat_acct, 'debit', 0,               'credit', vat_amount,
        'currency', 'USD', 'memo', 'Output VAT on sale ' || NEW.id::text,
        'meta', jsonb_build_object('sale_id', NEW.id, 'vat_rate', '12.5%'))
    );
  ELSE
    entries_json := jsonb_build_array(
      jsonb_build_object('account_code', ar_acct,  'debit', NEW.total, 'credit', 0,
        'currency', 'USD', 'memo', 'Sale to ' || NEW.customer_name,
        'meta', jsonb_build_object('sale_id', NEW.id)),
      jsonb_build_object('account_code', rev_acct, 'debit', 0,         'credit', NEW.total,
        'currency', 'USD', 'memo', 'Revenue from sale ' || NEW.id::text,
        'meta', jsonb_build_object('sale_id', NEW.id))
    );
  END IF;

  total_debit_val := NEW.total;
  total_credit_val := NEW.total;
  new_balance_hash := public.compute_balance_hash(entries_json);

  SELECT id INTO existing_entry_id
  FROM public.ledger_entries
  WHERE transaction_id = NEW.id::text AND source_type = 'sale'
  LIMIT 1;

  IF existing_entry_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE id = existing_entry_id AND balance_hash = new_balance_hash) THEN
      RETURN NEW;
    ELSE
      UPDATE public.ledger_entries
      SET status = 'reversed',
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('reversed_at', now())
      WHERE id = existing_entry_id;
    END IF;
  END IF;

  INSERT INTO public.ledger_entries
    (source_type, source_id, transaction_id, entries, total_debit, total_credit, balance_hash, user_id, status)
  VALUES
    ('sale', NEW.id::text, NEW.id::text, entries_json, total_debit_val, total_credit_val, new_balance_hash, NEW.user_id, 'posted');

  RETURN NEW;
END;
$$;

-- 4. Updated expense trigger
CREATE OR REPLACE FUNCTION public.create_ledger_entry_from_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_entry_id uuid;
  new_balance_hash text;
  entries_json jsonb;
  total_debit_val numeric;
  total_credit_val numeric;
  expense_role text;
  expense_acct text;
  cash_acct text;
  vat_acct text;
  vat_amount numeric;
  expense_amount numeric;
BEGIN
  expense_role := CASE
    WHEN NEW.category = 'working-capital' THEN 'working_capital_expense'
    WHEN NEW.category = 'fixed-capital'   THEN 'fixed_capital_expense'
    ELSE                                       'general_expense'
  END;

  expense_acct := public.get_mapped_account(NEW.user_id, 'expense', expense_role,
    CASE
      WHEN NEW.category = 'working-capital' THEN '5100_operating_expenses'
      WHEN NEW.category = 'fixed-capital'   THEN '5200_capital_expenses'
      ELSE                                       '5000_general_expenses'
    END);
  cash_acct := public.get_mapped_account(NEW.user_id, 'expense', 'cash_bank', '1000_cash_bank');
  vat_acct  := public.get_mapped_account(NEW.user_id, 'expense', 'input_vat', '1200_vat_receivable');

  vat_amount     := COALESCE(NEW.vat_amount, 0);
  expense_amount := NEW.amount - vat_amount;

  IF vat_amount > 0 THEN
    entries_json := jsonb_build_array(
      jsonb_build_object('account_code', expense_acct, 'debit', expense_amount, 'credit', 0,
        'currency', 'USD', 'memo', NEW.description,
        'meta', jsonb_build_object('expense_id', NEW.id, 'type', NEW.type)),
      jsonb_build_object('account_code', vat_acct,     'debit', vat_amount,     'credit', 0,
        'currency', 'USD', 'memo', 'Input VAT on ' || NEW.description,
        'meta', jsonb_build_object('expense_id', NEW.id, 'vat_rate', '12.5%')),
      jsonb_build_object('account_code', cash_acct,    'debit', 0,              'credit', NEW.amount,
        'currency', 'USD', 'memo', 'Payment for ' || NEW.description || ' (including VAT)',
        'meta', jsonb_build_object('expense_id', NEW.id))
    );
  ELSE
    entries_json := jsonb_build_array(
      jsonb_build_object('account_code', expense_acct, 'debit', NEW.amount, 'credit', 0,
        'currency', 'USD', 'memo', NEW.description,
        'meta', jsonb_build_object('expense_id', NEW.id, 'type', NEW.type)),
      jsonb_build_object('account_code', cash_acct,    'debit', 0,          'credit', NEW.amount,
        'currency', 'USD', 'memo', 'Payment for ' || NEW.description,
        'meta', jsonb_build_object('expense_id', NEW.id))
    );
  END IF;

  total_debit_val := NEW.amount;
  total_credit_val := NEW.amount;
  new_balance_hash := public.compute_balance_hash(entries_json);

  SELECT id INTO existing_entry_id
  FROM public.ledger_entries
  WHERE transaction_id = NEW.id::text AND source_type = 'expense'
  LIMIT 1;

  IF existing_entry_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE id = existing_entry_id AND balance_hash = new_balance_hash) THEN
      RETURN NEW;
    ELSE
      UPDATE public.ledger_entries
      SET status = 'reversed',
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('reversed_at', now())
      WHERE id = existing_entry_id;
    END IF;
  END IF;

  INSERT INTO public.ledger_entries
    (source_type, source_id, transaction_id, entries, total_debit, total_credit, balance_hash, user_id, status)
  VALUES
    ('expense', NEW.id::text, NEW.id::text, entries_json, total_debit_val, total_credit_val, new_balance_hash, NEW.user_id, 'posted');

  RETURN NEW;
END;
$$;

-- 5. Updated payment trigger
CREATE OR REPLACE FUNCTION public.create_ledger_entry_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_entry_id uuid;
  new_balance_hash text;
  entries_json jsonb;
  total_debit_val numeric;
  total_credit_val numeric;
  cash_acct text;
  ar_acct text;
BEGIN
  IF NEW.status != 'paid' OR (OLD.status IS NOT NULL AND OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;

  cash_acct := public.get_mapped_account(NEW.user_id, 'payment', 'cash_bank',           '1000_cash_bank');
  ar_acct   := public.get_mapped_account(NEW.user_id, 'payment', 'accounts_receivable', '1100_accounts_receivable');

  entries_json := jsonb_build_array(
    jsonb_build_object('account_code', cash_acct, 'debit', NEW.amount, 'credit', 0,
      'currency', 'USD', 'memo', 'Payment received from ' || NEW.customer,
      'meta', jsonb_build_object('payment_id', NEW.id, 'method', NEW.payment_method)),
    jsonb_build_object('account_code', ar_acct,   'debit', 0,          'credit', NEW.amount,
      'currency', 'USD', 'memo', 'Payment for ' || NEW.product,
      'meta', jsonb_build_object('payment_id', NEW.id))
  );

  total_debit_val := NEW.amount;
  total_credit_val := NEW.amount;
  new_balance_hash := public.compute_balance_hash(entries_json);

  SELECT id INTO existing_entry_id
  FROM public.ledger_entries
  WHERE transaction_id = NEW.id::text AND source_type = 'payment'
  LIMIT 1;

  IF existing_entry_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE id = existing_entry_id AND balance_hash = new_balance_hash) THEN
      RETURN NEW;
    ELSE
      UPDATE public.ledger_entries
      SET status = 'reversed',
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('reversed_at', now())
      WHERE id = existing_entry_id;
    END IF;
  END IF;

  INSERT INTO public.ledger_entries
    (source_type, source_id, transaction_id, entries, total_debit, total_credit, balance_hash, user_id, status)
  VALUES
    ('payment', NEW.id::text, NEW.id::text, entries_json, total_debit_val, total_credit_val, new_balance_hash, NEW.user_id, 'posted');

  RETURN NEW;
END;
$$;
