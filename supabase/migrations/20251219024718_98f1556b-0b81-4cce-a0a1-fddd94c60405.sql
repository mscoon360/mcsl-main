-- Create rental expense line items table for detailed cost breakdowns
CREATE TABLE public.rental_expense_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.rental_payment_term_expenses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  quantity numeric DEFAULT 1,
  unit_cost numeric DEFAULT 0,
  usage_rate text,
  monthly_cost numeric DEFAULT 0,
  annual_cost numeric DEFAULT 0,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX rental_expense_line_items_expense_id ON public.rental_expense_line_items(expense_id);

-- Enable RLS
ALTER TABLE public.rental_expense_line_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all rental expense line items"
ON public.rental_expense_line_items
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own rental expense line items"
ON public.rental_expense_line_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rental expense line items"
ON public.rental_expense_line_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rental expense line items"
ON public.rental_expense_line_items
FOR DELETE
USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER set_rental_expense_line_items_updated_at
BEFORE UPDATE ON public.rental_expense_line_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();