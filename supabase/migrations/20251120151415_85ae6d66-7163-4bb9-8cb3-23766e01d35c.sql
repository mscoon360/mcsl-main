-- Create table for user-pinned locations
CREATE TABLE public.pinned_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pinned_locations ENABLE ROW LEVEL SECURITY;

-- Users can view their own pins
CREATE POLICY "Users can view their own pinned locations"
ON public.pinned_locations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own pins
CREATE POLICY "Users can create their own pinned locations"
ON public.pinned_locations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pins
CREATE POLICY "Users can update their own pinned locations"
ON public.pinned_locations
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own pins
CREATE POLICY "Users can delete their own pinned locations"
ON public.pinned_locations
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pinned_locations_updated_at
BEFORE UPDATE ON public.pinned_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();