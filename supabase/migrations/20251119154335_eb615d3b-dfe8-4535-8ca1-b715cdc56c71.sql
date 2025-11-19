-- Add companion column to fleet_vehicles table
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS companion text;