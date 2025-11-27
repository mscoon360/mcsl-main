-- Add VAT accounts to chart of accounts for proper VAT tracking

-- Output VAT (VAT Payable) - Liability account for VAT collected from customers
INSERT INTO public.chart_of_accounts (
  account_number,
  account_name,
  account_type,
  account_subtype,
  description,
  is_active,
  balance,
  user_id
)
SELECT 
  '2300_vat_payable',
  'VAT Payable (Output VAT)',
  'liability',
  'current-liability',
  'VAT collected from customers on sales - payable to tax authority',
  true,
  0,
  id
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts 
  WHERE account_number = '2300_vat_payable'
);

-- Input VAT (VAT Receivable) - Asset account for VAT paid on purchases
INSERT INTO public.chart_of_accounts (
  account_number,
  account_name,
  account_type,
  account_subtype,
  description,
  is_active,
  balance,
  user_id
)
SELECT 
  '1200_vat_receivable',
  'VAT Receivable (Input VAT)',
  'asset',
  'current-asset',
  'VAT paid on purchases - recoverable from tax authority',
  true,
  0,
  id
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts 
  WHERE account_number = '1200_vat_receivable'
);

-- Update the ledger entry trigger for sales to include VAT accounting
CREATE OR REPLACE FUNCTION public.create_ledger_entry_from_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_entry_id uuid;
  new_balance_hash text;
  entries_json jsonb;
  total_debit_val numeric;
  total_credit_val numeric;
  vat_amount numeric;
  revenue_amount numeric;
BEGIN
  -- Skip if status is not completed
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Calculate VAT and revenue amounts
  vat_amount := COALESCE(NEW.vat_amount, 0);
  revenue_amount := NEW.total - vat_amount;

  -- Build journal entries with VAT split
  IF vat_amount > 0 THEN
    -- Sale with VAT
    entries_json := jsonb_build_array(
      jsonb_build_object(
        'account_code', '1100_accounts_receivable',
        'debit', NEW.total,
        'credit', 0,
        'currency', 'USD',
        'memo', 'Sale to ' || NEW.customer_name || ' (including VAT)',
        'meta', jsonb_build_object('sale_id', NEW.id)
      ),
      jsonb_build_object(
        'account_code', '4000_sales_revenue',
        'debit', 0,
        'credit', revenue_amount,
        'currency', 'USD',
        'memo', 'Revenue from sale ' || NEW.id::text,
        'meta', jsonb_build_object('sale_id', NEW.id)
      ),
      jsonb_build_object(
        'account_code', '2300_vat_payable',
        'debit', 0,
        'credit', vat_amount,
        'currency', 'USD',
        'memo', 'Output VAT on sale ' || NEW.id::text,
        'meta', jsonb_build_object('sale_id', NEW.id, 'vat_rate', '12.5%')
      )
    );
  ELSE
    -- Sale without VAT (original logic)
    entries_json := jsonb_build_array(
      jsonb_build_object(
        'account_code', '1100_accounts_receivable',
        'debit', NEW.total,
        'credit', 0,
        'currency', 'USD',
        'memo', 'Sale to ' || NEW.customer_name,
        'meta', jsonb_build_object('sale_id', NEW.id)
      ),
      jsonb_build_object(
        'account_code', '4000_sales_revenue',
        'debit', 0,
        'credit', NEW.total,
        'currency', 'USD',
        'memo', 'Revenue from sale ' || NEW.id::text,
        'meta', jsonb_build_object('sale_id', NEW.id)
      )
    );
  END IF;

  total_debit_val := NEW.total;
  total_credit_val := NEW.total;
  new_balance_hash := public.compute_balance_hash(entries_json);

  -- Check for existing entry with same transaction_id
  SELECT id INTO existing_entry_id
  FROM public.ledger_entries
  WHERE transaction_id = NEW.id::text
    AND source_type = 'sale'
  LIMIT 1;

  IF existing_entry_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ledger_entries
      WHERE id = existing_entry_id AND balance_hash = new_balance_hash
    ) THEN
      RETURN NEW;
    ELSE
      UPDATE public.ledger_entries
      SET status = 'reversed',
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('reversed_at', now())
      WHERE id = existing_entry_id;
    END IF;
  END IF;

  -- Insert new ledger entry
  INSERT INTO public.ledger_entries (
    source_type,
    source_id,
    transaction_id,
    entries,
    total_debit,
    total_credit,
    balance_hash,
    user_id,
    status
  ) VALUES (
    'sale',
    NEW.id::text,
    NEW.id::text,
    entries_json,
    total_debit_val,
    total_credit_val,
    new_balance_hash,
    NEW.user_id,
    'posted'
  );

  RETURN NEW;
END;
$$;

-- Update the ledger entry trigger for expenses to include VAT accounting
CREATE OR REPLACE FUNCTION public.create_ledger_entry_from_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_entry_id uuid;
  new_balance_hash text;
  entries_json jsonb;
  total_debit_val numeric;
  total_credit_val numeric;
  expense_account text;
  vat_amount numeric;
  expense_amount numeric;
BEGIN
  -- Map category to expense account
  expense_account := CASE
    WHEN NEW.category = 'working-capital' THEN '5100_operating_expenses'
    WHEN NEW.category = 'fixed-capital' THEN '5200_capital_expenses'
    ELSE '5000_general_expenses'
  END;

  -- Calculate VAT and expense amounts
  vat_amount := COALESCE(NEW.vat_amount, 0);
  expense_amount := NEW.amount - vat_amount;

  -- Build journal entries with VAT split
  IF vat_amount > 0 THEN
    -- Expense with VAT
    entries_json := jsonb_build_array(
      jsonb_build_object(
        'account_code', expense_account,
        'debit', expense_amount,
        'credit', 0,
        'currency', 'USD',
        'memo', NEW.description,
        'meta', jsonb_build_object('expense_id', NEW.id, 'type', NEW.type)
      ),
      jsonb_build_object(
        'account_code', '1200_vat_receivable',
        'debit', vat_amount,
        'credit', 0,
        'currency', 'USD',
        'memo', 'Input VAT on ' || NEW.description,
        'meta', jsonb_build_object('expense_id', NEW.id, 'vat_rate', '12.5%')
      ),
      jsonb_build_object(
        'account_code', '1000_cash_bank',
        'debit', 0,
        'credit', NEW.amount,
        'currency', 'USD',
        'memo', 'Payment for ' || NEW.description || ' (including VAT)',
        'meta', jsonb_build_object('expense_id', NEW.id)
      )
    );
  ELSE
    -- Expense without VAT (original logic)
    entries_json := jsonb_build_array(
      jsonb_build_object(
        'account_code', expense_account,
        'debit', NEW.amount,
        'credit', 0,
        'currency', 'USD',
        'memo', NEW.description,
        'meta', jsonb_build_object('expense_id', NEW.id, 'type', NEW.type)
      ),
      jsonb_build_object(
        'account_code', '1000_cash_bank',
        'debit', 0,
        'credit', NEW.amount,
        'currency', 'USD',
        'memo', 'Payment for ' || NEW.description,
        'meta', jsonb_build_object('expense_id', NEW.id)
      )
    );
  END IF;

  total_debit_val := NEW.amount;
  total_credit_val := NEW.amount;
  new_balance_hash := public.compute_balance_hash(entries_json);

  -- Check for existing entry
  SELECT id INTO existing_entry_id
  FROM public.ledger_entries
  WHERE transaction_id = NEW.id::text
    AND source_type = 'expense'
  LIMIT 1;

  IF existing_entry_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ledger_entries
      WHERE id = existing_entry_id AND balance_hash = new_balance_hash
    ) THEN
      RETURN NEW;
    ELSE
      UPDATE public.ledger_entries
      SET status = 'reversed',
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('reversed_at', now())
      WHERE id = existing_entry_id;
    END IF;
  END IF;

  -- Insert new ledger entry
  INSERT INTO public.ledger_entries (
    source_type,
    source_id,
    transaction_id,
    entries,
    total_debit,
    total_credit,
    balance_hash,
    user_id,
    status
  ) VALUES (
    'expense',
    NEW.id::text,
    NEW.id::text,
    entries_json,
    total_debit_val,
    total_credit_val,
    new_balance_hash,
    NEW.user_id,
    'posted'
  );

  RETURN NEW;
END;
$$;