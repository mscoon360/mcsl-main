-- Add needs_password_change column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS needs_password_change boolean DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_needs_password_change 
ON public.profiles(needs_password_change) 
WHERE needs_password_change = true;