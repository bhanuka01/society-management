-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- Adds Cal.com interview booking columns and status support to the `oc` table.

ALTER TABLE oc
  ADD COLUMN IF NOT EXISTS interview_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS interview_link TEXT,
  ADD COLUMN IF NOT EXISTS cal_booking_id TEXT,
  ADD COLUMN IF NOT EXISTS interview_notes TEXT,
  ADD COLUMN IF NOT EXISTS interviewer_email TEXT;

-- Update RLS or permissions if required
GRANT ALL ON TABLE oc TO service_role;
GRANT ALL ON TABLE oc TO authenticated;
GRANT SELECT ON TABLE oc TO anon;
