-- Add price column to supplies table
ALTER TABLE public.supplies ADD COLUMN price NUMERIC;

-- Create function to automatically create expense when supply is added
CREATE OR REPLACE FUNCTION public.create_supply_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only create expense if price is set and greater than 0
  IF NEW.price IS NOT NULL AND NEW.price > 0 THEN
    INSERT INTO public.expenditures (
      user_id,
      description,
      amount,
      date,
      category,
      type
    ) VALUES (
      NEW.user_id,
      'Supply Purchase: ' || NEW.name || COALESCE(' (' || NEW.quantity::text || ' ' || NEW.unit || ')', ''),
      NEW.price * NEW.quantity,
      COALESCE(NEW.last_restock_date, CURRENT_DATE),
      COALESCE(NEW.category, 'Supplies'),
      'supplies'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new supplies
CREATE TRIGGER create_expense_on_supply_insert
AFTER INSERT ON public.supplies
FOR EACH ROW
EXECUTE FUNCTION public.create_supply_expense();