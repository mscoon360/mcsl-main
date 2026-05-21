
CREATE TABLE public.vehicle_status_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_id UUID,
  -- GPS & Tracking
  gps_installed BOOLEAN DEFAULT false,
  tracker_id TEXT,
  fuel_card_assigned TEXT,
  dashcam_installed BOOLEAN DEFAULT false,
  average_daily_mileage NUMERIC,
  -- Documents (URLs)
  insurance_doc TEXT,
  registration_doc TEXT,
  inspection_doc TEXT,
  service_records_doc TEXT,
  vehicle_photos TEXT[],
  accident_report_doc TEXT,
  -- Operational Status
  vehicle_availability TEXT CHECK (vehicle_availability IN ('available','on_job','out_of_service','in_maintenance')),
  current_location TEXT,
  assigned_route_zone TEXT,
  last_inspection_passed DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_status_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own status reports"
  ON public.vehicle_status_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own status reports"
  ON public.vehicle_status_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own status reports"
  ON public.vehicle_status_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own status reports"
  ON public.vehicle_status_reports FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_vehicle_status_reports_updated_at
  BEFORE UPDATE ON public.vehicle_status_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
