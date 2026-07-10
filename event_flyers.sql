-- Migration: Create event_flyers bucket and set storage policies.
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('event_flyers', 'event_flyers', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public reading of objects in the event_flyers bucket
CREATE POLICY "Allow public select for event flyers" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'event_flyers');

-- 3. Allow authenticated users to upload/insert flyers
CREATE POLICY "Allow authenticated inserts for event flyers" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'event_flyers' AND auth.role() = 'authenticated');

-- 4. Allow authenticated users to update/modify flyers
CREATE POLICY "Allow authenticated updates for event flyers" 
ON storage.objects FOR UPDATE 
WITH CHECK (bucket_id = 'event_flyers' AND auth.role() = 'authenticated');

-- 5. Allow authenticated users to delete flyers
CREATE POLICY "Allow authenticated deletes for event flyers" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'event_flyers' AND auth.role() = 'authenticated');
