-- Create inspections table
CREATE TABLE public.inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  inspection_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Policies for inspections
CREATE POLICY "Users can insert their own inspections"
  ON public.inspections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all inspections"
  ON public.inspections
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can update inspections"
  ON public.inspections
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own pending inspections"
  ON public.inspections
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- Trigger for updated_at
CREATE TRIGGER update_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for inspection photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true);

-- Storage policies
CREATE POLICY "Users can upload inspection photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'inspection-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view inspection photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'inspection-photos');

CREATE POLICY "Users can update their own photos"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'inspection-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can delete inspection photos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'inspection-photos' AND has_role(auth.uid(), 'admin'));