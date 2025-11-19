-- Create fleet_vehicles table
CREATE TABLE public.fleet_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  license_plate TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT NOT NULL,
  mpg NUMERIC NOT NULL,
  inspection_cycle TEXT NOT NULL,
  last_inspection_date DATE,
  next_inspection_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  mileage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all fleet vehicles"
  ON public.fleet_vehicles
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert fleet vehicles"
  ON public.fleet_vehicles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fleet vehicles"
  ON public.fleet_vehicles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fleet vehicles"
  ON public.fleet_vehicles
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any fleet vehicles"
  ON public.fleet_vehicles
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_fleet_vehicles_updated_at
  BEFORE UPDATE ON public.fleet_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();