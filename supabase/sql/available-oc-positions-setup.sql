-- Migration: Add available_oc_positions column to events table
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

ALTER TABLE events ADD COLUMN IF NOT EXISTS available_oc_positions TEXT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
