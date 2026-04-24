-- Sage-style chart of accounts: seed defaults on signup + roll ledger entries into account balances.

-- 1. Reusable seeder with the Sage-style template (idempotent via ON CONFLICT).
CREATE OR REPLACE FUNCTION public.seed_default_chart_of_accounts(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chart_of_accounts
    (user_id, account_number, account_name, account_type, account_subtype, description, is_active, balance)
  VALUES
    -- Fixed Assets (0010-0050)
    (p_user_id, '0010', 'Freehold Property',          'asset',     'fixed-asset',         'Land and buildings owned outright', true, 0),
    (p_user_id, '0020', 'Leasehold Property',         'asset',     'fixed-asset',         'Property held under lease',         true, 0),
    (p_user_id, '0030', 'Plant and Machinery',        'asset',     'fixed-asset',         'Production plant and machinery',    true, 0),
    (p_user_id, '0040', 'Office Equipment',           'asset',     'fixed-asset',         'Computers, furniture, office kit',  true, 0),
    (p_user_id, '0050', 'Motor Vehicles',             'asset',     'fixed-asset',         'Company-owned motor vehicles',      true, 0),

    -- Current Assets (1000-1299) - codes match the ledger triggers
    (p_user_id, '1000_cash_bank',            'Bank Current Account',           'asset', 'current-asset', 'Primary bank operating account',                              true, 0),
    (p_user_id, '1001',                      'Stock / Inventory',              'asset', 'current-asset', 'Goods held for resale',                                       true, 0),
    (p_user_id, '1100_accounts_receivable',  'Accounts Receivable (Debtors)',  'asset', 'current-asset', 'Amounts owed by customers',                                   true, 0),
    (p_user_id, '1200_vat_receivable',       'VAT Receivable (Input VAT)',     'asset', 'current-asset', 'VAT paid on purchases - recoverable from tax authority',      true, 0),
    (p_user_id, '1230',                      'Petty Cash',                     'asset', 'current-asset', 'Cash on hand for small expenses',                             true, 0),

    -- Current Liabilities (2100-2399)
    (p_user_id, '2100',               'Accounts Payable (Creditors)', 'liability', 'current-liability', 'Amounts owed to suppliers',                                    true, 0),
    (p_user_id, '2210',               'PAYE',                         'liability', 'current-liability', 'Pay As You Earn tax payable',                                  true, 0),
    (p_user_id, '2220',               'Net Wages Payable',            'liability', 'current-liability', 'Net wages owed to employees',                                  true, 0),
    (p_user_id, '2300_vat_payable',   'VAT Payable (Output VAT)',     'liability', 'current-liability', 'VAT collected from customers on sales - payable to authority', true, 0),

    -- Long-term Liabilities
    (p_user_id, '2400', 'Long-term Loans', 'liability', 'long-term-liability', 'Loans repayable after more than 12 months', true, 0),

    -- Capital & Reserves (3000-3299)
    (p_user_id, '3000', 'Capital',           'equity', 'equity', 'Owner capital contributions',                  true, 0),
    (p_user_id, '3100', 'Drawings',          'equity', 'equity', 'Owner drawings from the business',             true, 0),
    (p_user_id, '3200', 'Retained Earnings', 'equity', 'equity', 'Accumulated profits retained in the business', true, 0),

    -- Sales / Revenue (4000-4999)
    (p_user_id, '4000_sales_revenue', 'Sales Revenue',      'revenue', 'operating-revenue', 'Primary sales revenue from goods or services', true, 0),
    (p_user_id, '4100',               'Sales - Services',   'revenue', 'operating-revenue', 'Revenue from services rendered',               true, 0),
    (p_user_id, '4200',               'Sales of Assets',    'revenue', 'other-revenue',     'Proceeds from sale of fixed assets',           true, 0),
    (p_user_id, '4900',               'Other Income',       'revenue', 'other-revenue',     'Miscellaneous income',                         true, 0),

    -- Expenses (5000-5299) - codes match the ledger triggers
    (p_user_id, '5000_general_expenses',    'General Expenses',     'expense', 'operating-expense', 'Uncategorised operating costs',              true, 0),
    (p_user_id, '5100_operating_expenses',  'Operating Expenses',   'expense', 'operating-expense', 'Day-to-day operating costs',                 true, 0),
    (p_user_id, '5200_capital_expenses',    'Capital Expenses',     'expense', 'other-expense',     'Capital expenditure (fixed capital)',        true, 0),
    (p_user_id, '6000',                     'Cost of Materials',    'expense', 'cost-of-goods-sold','Materials consumed in production or resale', true, 0),

    -- Overheads (7000-7999)
    (p_user_id, '7000', 'Gross Wages',                    'expense', 'operating-expense', 'Gross wages and salaries',               true, 0),
    (p_user_id, '7100', 'Rent',                           'expense', 'operating-expense', 'Premises rent',                          true, 0),
    (p_user_id, '7200', 'Electricity',                    'expense', 'operating-expense', 'Electricity and utilities',              true, 0),
    (p_user_id, '7300', 'Travel & Subsistence',           'expense', 'operating-expense', 'Business travel and subsistence',        true, 0),
    (p_user_id, '7500', 'Printing, Postage & Stationery', 'expense', 'operating-expense', 'Office supplies and postage',            true, 0),
    (p_user_id, '7600', 'Legal & Professional Fees',      'expense', 'operating-expense', 'Legal, accounting and professional fees',true, 0),
    (p_user_id, '7900', 'Bank Charges',                   'expense', 'operating-expense', 'Bank fees and charges',                  true, 0)
  ON CONFLICT (user_id, account_number) DO NOTHING;
END;
$$;

-- 2. Extend handle_new_user so every new signup gets the Sage-style chart.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, department)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', new.email),
    COALESCE(new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'department', '')
  );

  PERFORM public.seed_default_chart_of_accounts(new.id);

  RETURN new;
END;
$$;

-- 3. Backfill the defaults for every existing user.
DO $$
DECLARE
  u record;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_default_chart_of_accounts(u.id);
  END LOOP;
END $$;

-- 4. Roll posted ledger entries into chart_of_accounts.balance for one user.
--    Debit-natured accounts (asset/expense): balance = sum(debit) - sum(credit).
--    Credit-natured accounts (liability/equity/revenue): balance = sum(credit) - sum(debit).
CREATE OR REPLACE FUNCTION public.refresh_chart_of_accounts_balances(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ledger_totals AS (
    SELECT
      (entry->>'account_code') AS account_code,
      SUM(COALESCE((entry->>'debit')::numeric, 0))  AS total_debit,
      SUM(COALESCE((entry->>'credit')::numeric, 0)) AS total_credit
    FROM public.ledger_entries le
    CROSS JOIN LATERAL jsonb_array_elements(le.entries) AS entry
    WHERE le.status = 'posted'
      AND le.user_id = p_user_id
    GROUP BY (entry->>'account_code')
  )
  UPDATE public.chart_of_accounts coa
  SET balance = CASE
    WHEN coa.account_type IN ('asset', 'expense')
      THEN COALESCE(lt.total_debit, 0) - COALESCE(lt.total_credit, 0)
    ELSE
      COALESCE(lt.total_credit, 0) - COALESCE(lt.total_debit, 0)
  END
  FROM ledger_totals lt
  WHERE coa.user_id = p_user_id
    AND coa.account_number = lt.account_code;

  -- Zero-out any accounts with no posted ledger activity.
  UPDATE public.chart_of_accounts coa
  SET balance = 0
  WHERE coa.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.ledger_entries le
      CROSS JOIN LATERAL jsonb_array_elements(le.entries) AS entry
      WHERE le.status = 'posted'
        AND le.user_id = p_user_id
        AND (entry->>'account_code') = coa.account_number
    );
END;
$$;

-- 5. Keep balances live on every ledger change.
CREATE OR REPLACE FUNCTION public.sync_chart_balances_on_ledger_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_chart_of_accounts_balances(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.refresh_chart_of_accounts_balances(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS sync_chart_balances_after_ledger_change ON public.ledger_entries;
CREATE TRIGGER sync_chart_balances_after_ledger_change
  AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_chart_balances_on_ledger_change();

-- 6. Initial balance backfill for users who already have ledger entries.
DO $$
DECLARE
  u record;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.ledger_entries LOOP
    PERFORM public.refresh_chart_of_accounts_balances(u.user_id);
  END LOOP;
END $$;
