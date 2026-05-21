-- Fleet section fixes:
--   1. Split driver_user_id from driver_phone on fleet_vehicles
--      (Fleet.tsx was silently storing the driver's user id in driver_phone).
--   2. Make sure realtime is enabled for the fleet tables that the UI now
--      subscribes to.

-- 1a. New column linking to the driver's user account.
ALTER TABLE public.fleet_vehicles
  ADD COLUMN IF NOT EXISTS driver_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1b. Migrate any uuid currently sitting in driver_phone over to
--     driver_user_id and clear the phone field. Only touches rows whose
--     driver_phone matches the canonical UUID pattern.
UPDATE public.fleet_vehicles
SET driver_user_id = NULLIF(driver_phone, '')::uuid,
    driver_phone   = NULL
WHERE driver_user_id IS NULL
  AND driver_phone ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 2. Add the fleet tables to the realtime publication so the new
--    subscriptions on the client receive change events. supabase_realtime is
--    created by the realtime extension; add tables only if they aren't
--    already members.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fleet_vehicles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_vehicles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fuel_records'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_records';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inspections'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vehicle_parts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_parts';
  END IF;
EXCEPTION
  -- Some Supabase environments don't expose the realtime publication; ignore
  -- so the migration doesn't fail.
  WHEN undefined_object THEN NULL;
END $$;
