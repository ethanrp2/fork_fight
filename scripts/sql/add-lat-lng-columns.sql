-- Add latitude/longitude columns for restaurants
-- Run in Supabase/Postgres
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lng double precision;

-- Optional: create index for distance queries (if you later compute server-side sorts)
-- CREATE INDEX IF NOT EXISTS idx_restaurants_lat_lng ON restaurants (lat, lng);

-- NOTE: Backfill strategy
-- - You can parse existing maps_url values to populate lat/lng.
-- - Recommend doing this in an application script to ensure robust parsing,
--   then UPDATE restaurants SET lat = ..., lng = ... WHERE id = ...;


