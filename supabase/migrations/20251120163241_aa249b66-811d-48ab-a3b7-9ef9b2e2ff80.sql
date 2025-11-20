-- Create fuel_records table
CREATE TABLE public.fuel_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.fleet_vehicles(id),
  refuel_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_cost NUMERIC NOT NULL,
  gallons NUMERIC NOT NULL,
  receipt_photo TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own fuel records"
  ON public.fuel_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all fuel records"
  ON public.fuel_records
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own fuel records"
  ON public.fuel_records
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fuel records"
  ON public.fuel_records
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any fuel records"
  ON public.fuel_records
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_fuel_records_updated_at
  BEFORE UPDATE ON public.fuel_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();