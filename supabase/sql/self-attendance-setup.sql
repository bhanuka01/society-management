-- Migration: Support self-attendance toggle and RLS policies for members
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

-- Add self_attendance_enabled field to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS self_attendance_enabled BOOLEAN DEFAULT FALSE;

-- Policies for Attendance table to allow members to mark their own attendance
DROP POLICY IF EXISTS "member insert own attendance" ON attendance;
CREATE POLICY "member insert own attendance" ON attendance FOR INSERT TO authenticated
WITH CHECK (
  st_id = (SELECT st_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM events
    WHERE events.event_id = attendance.event_id
      AND events.self_attendance_enabled = true
  )
);

DROP POLICY IF EXISTS "member update own attendance" ON attendance;
CREATE POLICY "member update own attendance" ON attendance FOR UPDATE TO authenticated
USING (
  st_id = (SELECT st_id FROM profiles WHERE id = auth.uid())
)
WITH CHECK (
  st_id = (SELECT st_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM events
    WHERE events.event_id = attendance.event_id
      AND events.self_attendance_enabled = true
  )
);

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
