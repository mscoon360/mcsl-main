-- Create ledger_entries table for double-entry bookkeeping
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('sale', 'payment', 'expense', 'refund', 'invoice_adjustment', 'accounts_payable', 'accounts_receivable')),
  source_id text NOT NULL,
  transaction_id text NOT NULL,
  entries jsonb NOT NULL,
  total_debit numeric NOT NULL DEFAULT 0,
  total_credit numeric NOT NULL DEFAULT 0,
  posted_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed', 'pending')),
  balance_hash text NOT NULL,
  meta jsonb,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON public.ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_source ON public.ledger_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_posted_at ON public.ledger_entries(posted_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_status ON public.ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_id ON public.ledger_entries(user_id);

-- Enable RLS
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert ledger entries"
  ON public.ledger_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update ledger entries"
  ON public.ledger_entries FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Create backfill log table
CREATE TABLE IF NOT EXISTS public.ledger_backfill_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backfill_logs_batch ON public.ledger_backfill_logs(batch_id);

-- Enable RLS
ALTER TABLE public.ledger_backfill_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backfill logs"
  ON public.ledger_backfill_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create test cases table
CREATE TABLE IF NOT EXISTS public.finance_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  test_type text NOT NULL,
  payload jsonb NOT NULL,
  expected_entries jsonb NOT NULL,
  last_run_at timestamp with time zone,
  last_run_status text,
  last_run_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.finance_test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage test cases"
  ON public.finance_test_cases FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Function to compute balance hash
CREATE OR REPLACE FUNCTION public.compute_balance_hash(entries jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
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

-- Function to validate ledger entry balance
CREATE OR REPLACE FUNCTION public.validate_ledger_balance()
RETURNS trigger
LANGUAGE plpgsql
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

-- Trigger to validate balance before insert/update
CREATE TRIGGER validate_ledger_balance_trigger
  BEFORE INSERT OR UPDATE ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ledger_balance();

-- Function to create ledger entry from sale
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
BEGIN
  -- Skip if status is not completed
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Build journal entries
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
    -- Entry exists, check if hash matches
    IF EXISTS (
      SELECT 1 FROM public.ledger_entries
      WHERE id = existing_entry_id
        AND balance_hash = new_balance_hash
    ) THEN
      -- Identical entry exists, skip
      RETURN NEW;
    ELSE
      -- Different entry, reverse old and create new
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

-- Trigger for sales
CREATE TRIGGER create_ledger_entry_on_sale
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.create_ledger_entry_from_sale();

-- Function to create ledger entry from payment schedule (collections)
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
BEGIN
  -- Only process when status changes to 'paid'
  IF NEW.status != 'paid' OR (OLD.status IS NOT NULL AND OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;

  -- Build journal entries
  entries_json := jsonb_build_array(
    jsonb_build_object(
      'account_code', '1000_cash_bank',
      'debit', NEW.amount,
      'credit', 0,
      'currency', 'USD',
      'memo', 'Payment received from ' || NEW.customer,
      'meta', jsonb_build_object('payment_id', NEW.id, 'method', NEW.payment_method)
    ),
    jsonb_build_object(
      'account_code', '1100_accounts_receivable',
      'debit', 0,
      'credit', NEW.amount,
      'currency', 'USD',
      'memo', 'Payment for ' || NEW.product,
      'meta', jsonb_build_object('payment_id', NEW.id)
    )
  );

  total_debit_val := NEW.amount;
  total_credit_val := NEW.amount;
  new_balance_hash := public.compute_balance_hash(entries_json);

  -- Check for existing entry
  SELECT id INTO existing_entry_id
  FROM public.ledger_entries
  WHERE transaction_id = NEW.id::text
    AND source_type = 'payment'
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
    'payment',
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

-- Trigger for payment schedules
CREATE TRIGGER create_ledger_entry_on_payment
  AFTER INSERT OR UPDATE ON public.payment_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.create_ledger_entry_from_payment();

-- Function to create ledger entry from expense
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
  expense_account text;
BEGIN
  -- Map category to expense account
  expense_account := CASE
    WHEN NEW.category = 'working-capital' THEN '5100_operating_expenses'
    WHEN NEW.category = 'fixed-capital' THEN '5200_capital_expenses'
    ELSE '5000_general_expenses'
  END;

  -- Build journal entries
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

-- Trigger for expenditures
CREATE TRIGGER create_ledger_entry_on_expense
  AFTER INSERT OR UPDATE ON public.expenditures
  FOR EACH ROW
  EXECUTE FUNCTION public.create_ledger_entry_from_expense();