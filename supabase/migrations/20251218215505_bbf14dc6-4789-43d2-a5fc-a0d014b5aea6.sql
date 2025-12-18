-- Add the new constraint with bi-monthly instead of bi-weekly
ALTER TABLE public.rental_payment_terms ADD CONSTRAINT rental_payment_terms_payment_term_check 
  CHECK (payment_term IN ('weekly', 'bi-monthly', 'monthly'));