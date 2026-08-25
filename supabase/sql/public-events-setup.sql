-- Migration: Support public events page details and registration form embeds.
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

-- Add public event content fields to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS time VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS tally_link TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
