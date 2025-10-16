-- Create enum for account types
CREATE TYPE public.account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

-- Create enum for account subtypes
CREATE TYPE public.account_subtype AS ENUM (
  'current-asset',
  'fixed-asset',
  'other-asset',
  'current-liability',
  'long-term-liability',
  'equity',
  'operating-revenue',
  'other-revenue',
  'cost-of-goods-sold',
  'operating-expense',
  'other-expense'
);

-- Create chart_of_accounts table
CREATE TABLE public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type account_type NOT NULL,
  account_subtype account_subtype NOT NULL,
  parent_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  description TEXT,
  balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, account_number)
);

-- Enable RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all accounts"
  ON public.chart_of_accounts
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert accounts"
  ON public.chart_of_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts"
  ON public.chart_of_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts"
  ON public.chart_of_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any accounts"
  ON public.chart_of_accounts
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();