-- Create table for National Petroleum gas station locations
CREATE TABLE IF NOT EXISTS public.np_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.np_stations ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read NP stations (public data)
CREATE POLICY "NP stations are viewable by everyone"
  ON public.np_stations
  FOR SELECT
  USING (true);

-- Only authenticated users can manage stations
CREATE POLICY "Authenticated users can insert NP stations"
  ON public.np_stations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update NP stations"
  ON public.np_stations
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete NP stations"
  ON public.np_stations
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_np_stations_updated_at
  BEFORE UPDATE ON public.np_stations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();