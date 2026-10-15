-- ==============================================================================
-- DATABASE OPTIMIZATION & PERFORMANCE INDEXES
-- Association of Data Science Students (ADSS) Management System
-- ==============================================================================

-- 1. FOREIGN KEY INDEXES (Eliminates sequential scans in JOINs and RLS subqueries)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_st_id ON public.profiles(st_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_st_id ON public.messages(sender_st_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_st_id ON public.messages(receiver_st_id);
CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON public.tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_st_id ON public.tasks(st_id);
CREATE INDEX IF NOT EXISTS idx_events_oc_st_id ON public.events(oc_st_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date DESC);
CREATE INDEX IF NOT EXISTS idx_oc_cal_booking_id ON public.oc(cal_booking_id);
CREATE INDEX IF NOT EXISTS idx_letter_requests_st_id ON public.letter_requests(st_id);

-- 2. SORT INDEXES (Optimizes ORDER BY queries on dashboard and list views)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letter_requests_created_at ON public.letter_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_event_attend ON public.attendance(event_id, attend);
CREATE INDEX IF NOT EXISTS idx_event_regs_event_attend ON public.event_registrations(event_id, attend);

-- 3. FUNCTIONAL INDEXES (Fixes sequential scans caused by regexp_replace in QR check-ins)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_members_norm_stid 
  ON public.members ((lower(trim(regexp_replace(st_id, '^sc\/', '', 'i')))));

CREATE INDEX IF NOT EXISTS idx_event_regs_norm_stid 
  ON public.event_registrations ((lower(trim(regexp_replace(st_id, '^sc\/', '', 'i')))));

-- 4. TRIGRAM INDEXES FOR FAST ILIKE SEARCHES (Supports member search and AI tools)
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_members_name_trgm 
  ON public.members USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_members_email_trgm 
  ON public.members USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_name_trgm 
  ON public.events USING gin (name gin_trgm_ops);

-- 5. REALTIME PUBLICATION STABILITY FIX
-- Ensure both messages and tasks are included in realtime without dropping other tables
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- 6. KEEP-ALIVE RPC (Safe non-shadowing keep-alive function)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.keep_alive() 
RETURNS timestamptz 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$ 
  SELECT clock_timestamp(); 
$$;

-- 7. SECURITY HARDENING: SECURE STORAGE POLICIES
-- Require authentication for uploading to profile_images bucket
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'profile_images') THEN
    DROP POLICY IF EXISTS "Allow public inserts" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated inserts for profile_images" ON storage.objects;
    
    CREATE POLICY "Allow authenticated inserts for profile_images" 
      ON storage.objects FOR INSERT 
      TO authenticated 
      WITH CHECK (bucket_id = 'profile_images');
  END IF;
END $$;

-- 8. SECURITY HARDENING: SECURE EVENT REGISTRATIONS RLS
-- Restrict mass deletion and unauthorized modification of attendee records
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_registrations') THEN
    DROP POLICY IF EXISTS "Allow public delete for registrations" ON public.event_registrations;
    DROP POLICY IF EXISTS "Allow public update for registrations" ON public.event_registrations;

    -- Allow staff to update or delete registrations
    CREATE POLICY "Allow staff to update registrations" 
      ON public.event_registrations FOR UPDATE 
      TO authenticated 
      USING (public.is_staff()) 
      WITH CHECK (public.is_staff());

    CREATE POLICY "Allow staff to delete registrations" 
      ON public.event_registrations FOR DELETE 
      TO authenticated 
      USING (public.is_staff());
  END IF;
END $$;

-- 9. NOTIFY POSTGREST SCHEMA RELOAD
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
