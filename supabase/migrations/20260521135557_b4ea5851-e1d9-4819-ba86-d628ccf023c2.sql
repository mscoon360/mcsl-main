
ALTER TABLE public.fleet_vehicles
  ADD COLUMN IF NOT EXISTS current_mileage NUMERIC,
  ADD COLUMN IF NOT EXISTS last_service_date DATE,
  ADD COLUMN IF NOT EXISTS next_service_date DATE,
  ADD COLUMN IF NOT EXISTS oil_change_interval TEXT,
  ADD COLUMN IF NOT EXISTS tire_change_date DATE,
  ADD COLUMN IF NOT EXISTS battery_change_date DATE,
  ADD COLUMN IF NOT EXISTS brake_service_date DATE,
  ADD COLUMN IF NOT EXISTS maintenance_status TEXT,
  ADD COLUMN IF NOT EXISTS preferred_mechanic TEXT;

CREATE TABLE IF NOT EXISTS public.driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
  driver_name TEXT NOT NULL,
  driver_license_number TEXT,
  license_expiry_date DATE,
  driver_contact TEXT,
  backup_driver TEXT,
  assignment_date DATE,
  responsibility_agreement_signed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view driver assignments"
  ON public.driver_assignments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can insert their own driver assignments"
  ON public.driver_assignments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own driver assignments"
  ON public.driver_assignments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own driver assignments"
  ON public.driver_assignments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_driver_assignments_updated_at
  BEFORE UPDATE ON public.driver_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
