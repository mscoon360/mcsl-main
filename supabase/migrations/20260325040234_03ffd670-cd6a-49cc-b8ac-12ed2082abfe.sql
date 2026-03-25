
DROP POLICY "Users can view all fleet vehicles" ON public.fleet_vehicles;
CREATE POLICY "Authenticated users can view all fleet vehicles"
  ON public.fleet_vehicles FOR SELECT
  TO authenticated
  USING (true);
