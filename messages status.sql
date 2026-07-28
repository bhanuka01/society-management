-- ① Add the status column (safe if already exists)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'in-progress', 'done'));

-- ② Back-fill old rows
UPDATE messages SET status = 'pending' WHERE status IS NULL;

-- ③ Allow realtime UPDATE events to broadcast the full row
--    (required for the live status-change listener to work)
ALTER TABLE messages REPLICA IDENTITY FULL;

-- ④ Enable the messages table for Supabase Realtime
--    (skip if already added via the Realtime dashboard)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE messages;
COMMIT;

-- ⑤ RLS UPDATE policy — allow receiver to update status on their own messages
--    (skip ⑤ entirely if your table has NO RLS enabled)
CREATE POLICY "receiver can update status"
  ON messages
  FOR UPDATE
  USING  (receiver_st_id = auth.uid()::text OR receiver_st_id = (SELECT st_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (true);
