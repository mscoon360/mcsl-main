-- Remove companion column from fleet_vehicles table
ALTER TABLE fleet_vehicles DROP COLUMN IF EXISTS companion;