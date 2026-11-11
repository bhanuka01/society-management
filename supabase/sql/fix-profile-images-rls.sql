-- ==============================================================================
-- STORAGE RLS FIX FOR PROFILE IMAGES (MEMBER DIGITAL PASS PHOTO)
-- Fixes: "Failed to upload profile image: new row violates row-level security policy"
--
-- Instructions:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Navigate to "SQL Editor" on the left navigation bar
-- 3. Paste this entire script and click "Run" (Ctrl+Enter / Cmd+Enter)
-- ==============================================================================

-- 1. Ensure the profile_images storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile_images',
  'profile_images',
  true,
  5242880, -- 5 MB max per photo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 2. Drop any existing/restrictive policies on storage.objects for profile_images
DROP POLICY IF EXISTS "Allow public inserts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated inserts for profile_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public inserts for profile_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select for profile_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates for profile_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates for profile_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes for profile_images" ON storage.objects;

-- 3. Allow public (unauthenticated / anon) uploads during registration
CREATE POLICY "Allow public inserts for profile_images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'profile_images');

-- 4. Allow public reading of objects (for digital pass and QR gate pass scanner)
CREATE POLICY "Allow public select for profile_images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile_images');

-- 5. Allow authenticated users to update/replace profile photos
CREATE POLICY "Allow authenticated updates for profile_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile_images')
WITH CHECK (bucket_id = 'profile_images');

-- 6. Allow authenticated users to delete profile photos
CREATE POLICY "Allow authenticated deletes for profile_images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile_images');
