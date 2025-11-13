-- Rename restaurants.image_slug -> restaurants.image_url
-- Run this in the Supabase SQL Editor (or psql) in your project database.
-- Safe to run once; it will fail if image_url already exists.

ALTER TABLE public.restaurants
  RENAME COLUMN image_slug TO image_url;

-- Optional: if you want to ensure text type (usually already text/varchar)
-- ALTER TABLE public.restaurants ALTER COLUMN image_url TYPE text;

-- Optional: add a comment for clarity
COMMENT ON COLUMN public.restaurants.image_url IS 'Public image URL used by the app';


