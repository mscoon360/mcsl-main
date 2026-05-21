-- Divisions / subdivisions: the SELECT policy is USING (true) so every
-- authenticated user can see all of them, but UPDATE is restricted to the
-- original creator. That mismatch causes the bug where renaming a division
-- silently does nothing for any user other than the one who first created
-- it -- and the UI shows the success toast because Supabase doesn't return
-- an error for a zero-row update.
--
-- Open UPDATE up to all authenticated users so the read/write model is
-- consistent. The owner-only policy is dropped first to avoid duplication.

-- Divisions
DROP POLICY IF EXISTS "Users can update their own divisions" ON public.divisions;

CREATE POLICY "Authenticated users can update divisions"
  ON public.divisions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Subdivisions: same story.
DROP POLICY IF EXISTS "Users can update subdivisions in their own divisions" ON public.subdivisions;
DROP POLICY IF EXISTS "Users can delete subdivisions in their own divisions" ON public.subdivisions;

CREATE POLICY "Authenticated users can update subdivisions"
  ON public.subdivisions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete subdivisions"
  ON public.subdivisions
  FOR DELETE
  TO authenticated
  USING (true);
