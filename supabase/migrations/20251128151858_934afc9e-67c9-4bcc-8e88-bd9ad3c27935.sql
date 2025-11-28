-- Create vehicle_parts table for tracking maintenance items
CREATE TABLE public.vehicle_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  part_category TEXT,
  installation_date DATE NOT NULL,
  lifespan_months INTEGER NOT NULL,
  next_replacement_date DATE NOT NULL,
  cost NUMERIC,
  supplier TEXT,
  status TEXT NOT NULL DEFAULT 'good',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vehicle_parts ENABLE ROW LEVEL SECURITY;

-- Create policies for vehicle_parts
CREATE POLICY "Users can view all vehicle parts"
ON public.vehicle_parts
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own vehicle parts"
ON public.vehicle_parts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vehicle parts"
ON public.vehicle_parts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vehicle parts"
ON public.vehicle_parts
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any vehicle parts"
ON public.vehicle_parts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_vehicle_parts_updated_at
BEFORE UPDATE ON public.vehicle_parts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();