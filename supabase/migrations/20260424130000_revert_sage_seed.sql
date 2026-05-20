-- Revert the Sage-style seed introduced in 20260424120000.
-- Restores the chart of accounts to its prior state by:
--   1. Removing the rows seeded by seed_default_chart_of_accounts (matched on
--      both account_number AND account_name to avoid touching anything a user
--      created manually that happens to share a code).
--   2. Dropping the seeder function.
--   3. Restoring handle_new_user to its original form (profile insert only).
--
-- The ledger -> chart_of_accounts balance-sync trigger and its helper are
-- left in place because they are independent of the seed and remain useful.

-- 1. Delete only rows whose (account_number, account_name) match the seed list.
DELETE FROM public.chart_of_accounts coa
USING (
  VALUES
    ('0010', 'Freehold Property'),
    ('0020', 'Leasehold Property'),
    ('0030', 'Plant and Machinery'),
    ('0040', 'Office Equipment'),
    ('0050', 'Motor Vehicles'),
    ('1000_cash_bank', 'Bank Current Account'),
    ('1001', 'Stock / Inventory'),
    ('1100_accounts_receivable', 'Accounts Receivable (Debtors)'),
    ('1230', 'Petty Cash'),
    ('2100', 'Accounts Payable (Creditors)'),
    ('2210', 'PAYE'),
    ('2220', 'Net Wages Payable'),
    ('2400', 'Long-term Loans'),
    ('3000', 'Capital'),
    ('3100', 'Drawings'),
    ('3200', 'Retained Earnings'),
    ('4000_sales_revenue', 'Sales Revenue'),
    ('4100', 'Sales - Services'),
    ('4200', 'Sales of Assets'),
    ('4900', 'Other Income'),
    ('5000_general_expenses', 'General Expenses'),
    ('5100_operating_expenses', 'Operating Expenses'),
    ('5200_capital_expenses', 'Capital Expenses'),
    ('6000', 'Cost of Materials'),
    ('7000', 'Gross Wages'),
    ('7100', 'Rent'),
    ('7200', 'Electricity'),
    ('7300', 'Travel & Subsistence'),
    ('7500', 'Printing, Postage & Stationery'),
    ('7600', 'Legal & Professional Fees'),
    ('7900', 'Bank Charges')
) AS seed(account_number, account_name)
WHERE coa.account_number = seed.account_number
  AND coa.account_name   = seed.account_name;

-- 2. Drop the seeder function (and any reference to it).
DROP FUNCTION IF EXISTS public.seed_default_chart_of_accounts(uuid);

-- 3. Restore handle_new_user to its original profile-only form.
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
  RETURN new;
END;
$$;
