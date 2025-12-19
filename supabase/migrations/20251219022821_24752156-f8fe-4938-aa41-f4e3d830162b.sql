-- Create rental payment term expense breakdown table
CREATE TABLE IF NOT EXISTS public.rental_payment_term_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payment_term text NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Basic uniqueness to avoid duplicates per product/term/category/name
CREATE UNIQUE INDEX IF NOT EXISTS rental_payment_term_expenses_uniq
  ON public.rental_payment_term_expenses(product_id, payment_term, category, name);

CREATE INDEX IF NOT EXISTS rental_payment_term_expenses_product_term
  ON public.rental_payment_term_expenses(product_id, payment_term);

-- Enable RLS
ALTER TABLE public.rental_payment_term_expenses ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rental_payment_term_expenses' AND policyname='Users can view all rental payment term expenses'
  ) THEN
    CREATE POLICY "Users can view all rental payment term expenses"
    ON public.rental_payment_term_expenses
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rental_payment_term_expenses' AND policyname='Users can insert their own rental payment term expenses'
  ) THEN
    CREATE POLICY "Users can insert their own rental payment term expenses"
    ON public.rental_payment_term_expenses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rental_payment_term_expenses' AND policyname='Users can update their own rental payment term expenses'
  ) THEN
    CREATE POLICY "Users can update their own rental payment term expenses"
    ON public.rental_payment_term_expenses
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rental_payment_term_expenses' AND policyname='Users can delete their own rental payment term expenses'
  ) THEN
    CREATE POLICY "Users can delete their own rental payment term expenses"
    ON public.rental_payment_term_expenses
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS set_rental_payment_term_expenses_updated_at ON public.rental_payment_term_expenses;
CREATE TRIGGER set_rental_payment_term_expenses_updated_at
BEFORE UPDATE ON public.rental_payment_term_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();