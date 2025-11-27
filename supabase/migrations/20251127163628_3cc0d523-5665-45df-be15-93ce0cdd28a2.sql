-- Create divisions table
CREATE TABLE IF NOT EXISTS public.divisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subdivisions table
CREATE TABLE IF NOT EXISTS public.subdivisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subdivisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for divisions
CREATE POLICY "Users can view all divisions"
  ON public.divisions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own divisions"
  ON public.divisions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own divisions"
  ON public.divisions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own divisions"
  ON public.divisions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any divisions"
  ON public.divisions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for subdivisions
CREATE POLICY "Users can view all subdivisions"
  ON public.subdivisions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert subdivisions to their own divisions"
  ON public.subdivisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.divisions
      WHERE divisions.id = subdivisions.division_id
      AND divisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update subdivisions in their own divisions"
  ON public.subdivisions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.divisions
      WHERE divisions.id = subdivisions.division_id
      AND divisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete subdivisions in their own divisions"
  ON public.subdivisions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.divisions
      WHERE divisions.id = subdivisions.division_id
      AND divisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete any subdivisions"
  ON public.subdivisions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));