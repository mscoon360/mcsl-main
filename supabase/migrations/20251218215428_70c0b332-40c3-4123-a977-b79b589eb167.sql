-- First drop the existing constraint
ALTER TABLE public.rental_payment_terms DROP CONSTRAINT IF EXISTS rental_payment_terms_payment_term_check;