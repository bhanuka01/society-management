-- Migration: Create event_registrations table and hardened server-signed QR attendance RPCs.
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

-- 3. Locked-down RLS policies: staff have full access; approved members can only read their own rows
DROP POLICY IF EXISTS "Allow public select for registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow public insert for registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow public update for registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow public delete for registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "staff manage event_registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "member read own event_registrations" ON public.event_registrations;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_registrations FROM anon;

CREATE POLICY "staff manage event_registrations" ON public.event_registrations
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "member read own event_registrations" ON public.event_registrations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.status = 'approved'
        AND nullif(trim(p.st_id), '') IS NOT NULL
        AND lower(trim(regexp_replace(p.st_id, '^sc/', '', 'i')))
          = lower(trim(regexp_replace(event_registrations.st_id, '^sc/', '', 'i')))
    )
  );

-- 4. Private HMAC-SHA256 signing secret & verifier for rotating QR attendance tokens
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.qr_signing_secrets (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.qr_signing_secrets FROM PUBLIC, anon, authenticated;

INSERT INTO private.qr_signing_secrets (id, secret)
VALUES (1, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.verify_attendance_qr_token(
  p_event_id TEXT,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
STABLE
AS $$
DECLARE
  v_parts TEXT[];
  v_exp BIGINT;
  v_sig TEXT;
  v_now_block BIGINT;
  v_secret TEXT;
  v_expected_sig TEXT;
BEGIN
  IF p_event_id IS NULL OR trim(p_event_id) = '' OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN false;
  END IF;

  v_parts := string_to_array(trim(p_token), '.');
  IF array_length(v_parts, 1) <> 2 THEN
    RETURN false;
  END IF;

  BEGIN
    v_exp := v_parts[1]::BIGINT;
  EXCEPTION
    WHEN others THEN
      RETURN false;
  END;

  v_sig := lower(v_parts[2]);

  v_now_block := floor(extract(epoch from now()) / 60)::BIGINT;
  IF abs(v_now_block - v_exp) > 2 THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE event_id = trim(p_event_id)) THEN
    RETURN false;
  END IF;

  SELECT secret INTO v_secret FROM private.qr_signing_secrets WHERE id = 1;
  IF v_secret IS NULL THEN
    RETURN false;
  END IF;

  v_expected_sig := encode(
    extensions.hmac(
      convert_to(trim(p_event_id) || ':' || v_exp::TEXT, 'utf8'),
      convert_to(v_secret, 'utf8'),
      'sha256'
    ),
    'hex'
  );

  RETURN v_sig = lower(v_expected_sig);
END;
$$;

REVOKE ALL ON FUNCTION private.verify_attendance_qr_token(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_attendance_qr_token(p_event_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_event_id TEXT := trim(coalesce(p_event_id, ''));
  v_exp BIGINT;
  v_secret TEXT;
  v_sig TEXT;
  v_token TEXT;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only approved staff can generate attendance QR tokens.'
      USING ERRCODE = '42501';
  END IF;

  IF v_event_id = '' OR NOT EXISTS (SELECT 1 FROM public.events WHERE event_id = v_event_id) THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  SELECT secret INTO v_secret FROM private.qr_signing_secrets WHERE id = 1;
  IF v_secret IS NULL THEN
    INSERT INTO private.qr_signing_secrets (id, secret)
    VALUES (1, encode(extensions.gen_random_bytes(32), 'hex'))
    ON CONFLICT (id) DO NOTHING;
    SELECT secret INTO v_secret FROM private.qr_signing_secrets WHERE id = 1;
  END IF;

  v_exp := floor(extract(epoch from now()) / 60)::BIGINT;
  v_sig := encode(
    extensions.hmac(
      convert_to(v_event_id || ':' || v_exp::TEXT, 'utf8'),
      convert_to(v_secret, 'utf8'),
      'sha256'
    ),
    'hex'
  );
  v_token := v_exp::TEXT || '.' || v_sig;

  RETURN jsonb_build_object(
    'token', v_token,
    'event_id', v_event_id,
    'exp', v_exp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_attendance_qr_token(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_attendance_qr_token(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_attendance_qr_token(
  p_event_id TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
STABLE
AS $$
DECLARE
  v_event RECORD;
BEGIN
  IF NOT private.verify_attendance_qr_token(p_event_id, p_token) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This dynamic QR code is invalid or expired. Please scan the current rotating code shown on the screen.'
    );
  END IF;

  SELECT event_id, name, date, time
  INTO v_event
  FROM public.events
  WHERE event_id = trim(p_event_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'The requested event was not found.'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'event', jsonb_build_object(
      'event_id', v_event.event_id,
      'name', v_event.name,
      'date', v_event.date,
      'time', v_event.time
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_attendance_qr_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_attendance_qr_token(TEXT, TEXT) TO anon, authenticated;

-- 5. Drop legacy unauthenticated overloads and recreate hardened RPCs
DROP FUNCTION IF EXISTS public.search_registration_by_id(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.check_member_by_id(VARCHAR);
DROP FUNCTION IF EXISTS public.record_csv_scan_attendance(VARCHAR, VARCHAR, BOOLEAN, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.search_registration_by_id(
  p_event_id VARCHAR(50),
  p_st_id VARCHAR(50),
  p_token TEXT DEFAULT NULL
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
SET search_path = public, private
AS $$
DECLARE
  v_is_staff BOOLEAN := public.is_staff();
  v_normalized_st_id VARCHAR(50);
BEGIN
  IF NOT v_is_staff AND NOT private.verify_attendance_qr_token(p_event_id, p_token) THEN
    RAISE EXCEPTION 'Unauthorized: A valid rotating event QR token is required.'
      USING ERRCODE = '42501';
  END IF;

  v_normalized_st_id := lower(trim(regexp_replace(coalesce(p_st_id, ''), '^sc\/', '', 'i')));
  IF v_normalized_st_id = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.event_id,
    r.st_id,
    r.name,
    CASE WHEN v_is_staff THEN r.email ELSE NULL END AS email,
    CASE WHEN v_is_staff THEN r.phone ELSE NULL END AS phone,
    r.degree_program,
    r.level,
    r.attend,
    (
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE lower(trim(regexp_replace(m.st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
      )
    ) AS is_member
  FROM public.event_registrations r
  WHERE r.event_id = p_event_id
    AND lower(trim(regexp_replace(r.st_id, '^sc\/', '', 'i'))) = v_normalized_st_id;
END;
$$;

REVOKE ALL ON FUNCTION public.search_registration_by_id(VARCHAR, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_registration_by_id(VARCHAR, VARCHAR, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_member_by_id(
  p_st_id VARCHAR(50),
  p_event_id VARCHAR(50) DEFAULT NULL,
  p_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  exists_member BOOLEAN,
  st_id VARCHAR(50),
  name VARCHAR(255),
  level VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_normalized_st_id VARCHAR(50);
BEGIN
  IF NOT public.is_staff()
     AND NOT (p_event_id IS NOT NULL AND private.verify_attendance_qr_token(p_event_id, p_token)) THEN
    RAISE EXCEPTION 'Unauthorized: A valid rotating event QR token is required.'
      USING ERRCODE = '42501';
  END IF;

  v_normalized_st_id := lower(trim(regexp_replace(coalesce(p_st_id, ''), '^sc\/', '', 'i')));
  IF v_normalized_st_id = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true AS exists_member,
    m.st_id,
    m.name,
    m.level::VARCHAR(50)
  FROM public.members m
  WHERE lower(trim(regexp_replace(m.st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.check_member_by_id(VARCHAR, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_member_by_id(VARCHAR, VARCHAR, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_csv_scan_attendance(
  p_event_id VARCHAR(50),
  p_st_id VARCHAR(50),
  p_is_member BOOLEAN DEFAULT false,
  p_name VARCHAR(255) DEFAULT NULL,
  p_email VARCHAR(255) DEFAULT NULL,
  p_phone VARCHAR(50) DEFAULT NULL,
  p_degree_program VARCHAR(255) DEFAULT NULL,
  p_level VARCHAR(50) DEFAULT NULL,
  p_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_member_exists BOOLEAN;
  v_reg_exists BOOLEAN;
  v_normalized_st_id VARCHAR(50);
  v_actual_st_id VARCHAR(50);
  v_final_name VARCHAR(255);
BEGIN
  IF NOT public.is_staff() AND NOT private.verify_attendance_qr_token(p_event_id, p_token) THEN
    RAISE EXCEPTION 'Unauthorized: This QR code is invalid or expired. Please scan the live QR code.'
      USING ERRCODE = '42501';
  END IF;

  v_normalized_st_id := lower(trim(regexp_replace(coalesce(p_st_id, ''), '^sc\/', '', 'i')));
  IF v_normalized_st_id = '' THEN
    RAISE EXCEPTION 'Student ID is required.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
  ) INTO v_member_exists;

  SELECT EXISTS (
    SELECT 1 FROM public.event_registrations
    WHERE event_id = p_event_id
      AND lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
  ) INTO v_reg_exists;

  IF v_reg_exists THEN
    UPDATE public.event_registrations
    SET attend = 'YES',
        is_member = v_member_exists
    WHERE event_id = p_event_id
      AND lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id;
  ELSE
    IF v_member_exists THEN
      SELECT name INTO v_final_name FROM public.members
      WHERE lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
      LIMIT 1;
    ELSE
      v_final_name := COALESCE(nullif(trim(p_name), ''), 'On-the-spot Attendee');
    END IF;

    INSERT INTO public.event_registrations (
      event_id, st_id, name, email, phone, degree_program, level, attend, is_member
    ) VALUES (
      p_event_id,
      trim(p_st_id),
      v_final_name,
      nullif(trim(p_email), ''),
      nullif(trim(p_phone), ''),
      nullif(trim(p_degree_program), ''),
      nullif(trim(p_level), ''),
      'YES',
      v_member_exists
    );
  END IF;

  IF v_member_exists THEN
    SELECT st_id INTO v_actual_st_id
    FROM public.members
    WHERE lower(trim(regexp_replace(st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
    LIMIT 1;

    IF v_actual_st_id IS NOT NULL THEN
      INSERT INTO public.attendance (st_id, event_id, attend)
      VALUES (v_actual_st_id, p_event_id, 'YES')
      ON CONFLICT (st_id, event_id)
      DO UPDATE SET attend = 'YES';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_member', v_member_exists,
    'message', 'Attendance recorded successfully!'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_csv_scan_attendance(VARCHAR, VARCHAR, BOOLEAN, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_csv_scan_attendance(VARCHAR, VARCHAR, BOOLEAN, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) TO anon, authenticated;

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
