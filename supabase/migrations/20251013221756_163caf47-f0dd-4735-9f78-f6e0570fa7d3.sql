-- Update trigger function to categorize supply expenses as working capital
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
      'working-capital', -- Ensure it's included in finance reports
      'supplies'
    );
  END IF;
  
  RETURN NEW;
END;
$$;