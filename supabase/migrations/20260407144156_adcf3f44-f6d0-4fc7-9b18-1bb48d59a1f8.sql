
-- Create services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  rental_price NUMERIC,
  sku TEXT NOT NULL,
  category TEXT,
  division_id UUID REFERENCES public.divisions(id),
  subdivision_id UUID REFERENCES public.subdivisions(id),
  status TEXT DEFAULT 'active',
  is_rental BOOLEAN DEFAULT false,
  is_rental_only BOOLEAN DEFAULT false,
  supplier_name TEXT,
  cost_price NUMERIC,
  needs_servicing BOOLEAN DEFAULT false,
  service_frequency TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all services"
  ON public.services FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert services"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own services"
  ON public.services FOR UPDATE
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own services"
  ON public.services FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any services"
  ON public.services FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create service_costings table
CREATE TABLE public.service_costings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  payment_term TEXT NOT NULL,
  rental_price NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC,
  refill_cost NUMERIC,
  battery_cost NUMERIC,
  battery_frequency_months INTEGER,
  indirect_cost_percentage NUMERIC,
  margin_percentage NUMERIC,
  total_direct_costs NUMERIC,
  total_cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.service_costings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all service costings"
  ON public.service_costings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert service costings"
  ON public.service_costings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own service costings"
  ON public.service_costings FOR UPDATE
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own service costings"
  ON public.service_costings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any service costings"
  ON public.service_costings FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_costings_updated_at
  BEFORE UPDATE ON public.service_costings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
