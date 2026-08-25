-- Migration: Create event_registrations table and helper functions for CSV attendance.
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

-- 1. Create the registrations table
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(50) REFERENCES public.events(event_id) ON DELETE CASCADE,
  st_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  degree_program VARCHAR(255),
  level VARCHAR(50),
  attend VARCHAR(10) DEFAULT 'NO',
  is_member BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, st_id)
);

-- Ensure columns exist if table was already created previously
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS degree_program VARCHAR(255);
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS level VARCHAR(50);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies to allow public operations (needed for QR scanning & admin management)
DROP POLICY IF EXISTS "Allow public select for registrations" ON public.event_registrations;
CREATE POLICY "Allow public select for registrations" ON public.event_registrations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert for registrations" ON public.event_registrations;
CREATE POLICY "Allow public insert for registrations" ON public.event_registrations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update for registrations" ON public.event_registrations;
CREATE POLICY "Allow public update for registrations" ON public.event_registrations
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete for registrations" ON public.event_registrations;
CREATE POLICY "Allow public delete for registrations" ON public.event_registrations
  FOR DELETE USING (true);


-- 4. Create search helper function (normalized matching)
-- Handles cases like SC/2022/12984, sc/2022/12984, 2022/12984 interchangeably.
CREATE OR REPLACE FUNCTION public.search_registration_by_id(
  p_event_id VARCHAR(50),
  p_st_id VARCHAR(50)
)
RETURNS TABLE (
  id BIGINT,
  event_id VARCHAR(50),
  st_id VARCHAR(50),
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  degree_program VARCHAR(255),
  level VARCHAR(50),
  attend VARCHAR(10),
  is_member BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_st_id VARCHAR(50);
BEGIN
  -- Normalize input: lowercase, trim, remove leading 'sc/' if present
  v_normalized_st_id := lower(trim(regexp_replace(p_st_id, '^sc\/', '', 'i')));
  
  RETURN QUERY
  SELECT 
    r.id,
    r.event_id,
    r.st_id,
    r.name,
    r.email,
    r.phone,
    r.degree_program,
    r.level,
    r.attend,
    (
      EXISTS (
        SELECT 1 FROM members m
        WHERE lower(trim(regexp_replace(m.st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
      )
    ) as is_member
  FROM event_registrations r
  WHERE r.event_id = p_event_id
    AND lower(trim(regexp_replace(r.st_id, '^sc\/', '', 'i'))) = v_normalized_st_id;
END;
$$;


-- 4b. Create member check helper function (normalized matching)
CREATE OR REPLACE FUNCTION public.check_member_by_id(p_st_id VARCHAR(50))
RETURNS TABLE (
  exists_member BOOLEAN,
  st_id VARCHAR(50),
  name VARCHAR(255),
  level VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_st_id VARCHAR(50);
BEGIN
  v_normalized_st_id := lower(trim(regexp_replace(p_st_id, '^sc\/', '', 'i')));
  
  RETURN QUERY
  SELECT 
    true as exists_member,
    m.st_id,
    m.name,
    m.level::VARCHAR(50)
  FROM members m
  WHERE lower(trim(regexp_replace(m.st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
  LIMIT 1;
END;
$$;


-- 5. Create attendance recorder function (SECURITY DEFINER to run with owner privileges)
-- Marks them present in the CSV registrations and, if they are a member, auto-marks present in the main attendance system.
CREATE OR REPLACE FUNCTION public.record_csv_scan_attendance(
  p_event_id VARCHAR(50),
  p_st_id VARCHAR(50),
  p_is_member BOOLEAN,
  p_name VARCHAR(255) DEFAULT NULL,
  p_email VARCHAR(255) DEFAULT NULL,
  p_phone VARCHAR(50) DEFAULT NULL,
  p_degree_program VARCHAR(255) DEFAULT NULL,
  p_level VARCHAR(50) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_exists BOOLEAN;
  v_reg_exists BOOLEAN;
  v_normalized_st_id VARCHAR(50);
  v_actual_st_id VARCHAR(50);
  v_final_name VARCHAR(255);
BEGIN
  -- Normalize input: lowercase, trim, remove leading 'sc/' if present
  v_normalized_st_id := lower(trim(regexp_replace(p_st_id, '^sc\/', '', 'i')));

  -- Verify member existence in primary members database
  SELECT EXISTS (
    SELECT 1 FROM members 
    WHERE lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
  ) INTO v_member_exists;

  -- Verify if registration exists
  SELECT EXISTS (
    SELECT 1 FROM event_registrations
    WHERE event_id = p_event_id
      AND lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
  ) INTO v_reg_exists;

  IF v_reg_exists THEN
    -- Update registrations status (YES means present)
    UPDATE event_registrations
    SET attend = 'YES',
        is_member = (v_member_exists OR p_is_member)
    WHERE event_id = p_event_id
      AND lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id;
  ELSE
    -- Resolve name: if member, pull name from members database, else use input
    IF v_member_exists THEN
      SELECT name INTO v_final_name FROM members
      WHERE lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
      LIMIT 1;
    ELSE
      v_final_name := COALESCE(p_name, 'On-the-spot Attendee');
    END IF;

    -- Create new on-the-spot registration
    INSERT INTO event_registrations (
      event_id, st_id, name, email, phone, degree_program, level, attend, is_member
    ) VALUES (
      p_event_id, 
      p_st_id, 
      v_final_name, 
      p_email, 
      p_phone, 
      p_degree_program, 
      p_level, 
      'YES', 
      (v_member_exists OR p_is_member)
    );
  END IF;

  -- 2. If society member, add auto present to primary attendance database
  IF v_member_exists OR p_is_member THEN
    -- Get the actual casing st_id from the members table
    SELECT st_id INTO v_actual_st_id
    FROM members
    WHERE lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
    LIMIT 1;

    -- Fallback
    IF v_actual_st_id IS NULL THEN
      v_actual_st_id := p_st_id;
    END IF;

    -- Seed attendance record if not exists
    INSERT INTO attendance (st_id, event_id, attend)
    VALUES (v_actual_st_id, p_event_id, 'YES')
    ON CONFLICT (st_id, event_id) 
    DO UPDATE SET attend = 'YES';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_member', (v_member_exists OR p_is_member),
    'message', 'Attendance recorded successfully!'
  );
END;
$$;

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
