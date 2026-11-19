-- ==============================================================================
-- IMMEDIATE SECURITY FIXES (#1, #2, #3)
-- Run this entire script once in Supabase SQL Editor (supabase.com -> SQL Editor)
--
-- Covers:
--   #1 Fix handle_new_user() role escalation + require status = 'approved' in
--      current_app_role() / is_staff() / is_admin().
--   #2 Lock status, st_id, role, email, and membership_status on public.profiles
--      via BEFORE UPDATE trigger + tightened RLS + safe sync_own_profile_st_id() RPC.
--   #3 Lock down public.event_registrations RLS and require server-signed
--      HMAC-SHA256 rotating QR tokens (or staff auth) in attendance RPCs.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- #1. Enforce status = 'approved' in role helpers & fix handle_new_user()
-- ------------------------------------------------------------------------------

-- Backfill any legacy rows with NULL status before enforcing strict check
UPDATE public.profiles
SET status = 'approved'
WHERE status IS NULL;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT role
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND status = 'approved'
    ),
    'guest'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.current_app_role() IN ('admin', 'editor');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.current_app_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
  v_has_staff_invite boolean := false;
  v_st_id varchar(50);
  v_name varchar(255);
  v_preferred_name varchar(255);
  v_status text;
  v_reg_enabled text;
  v_auto_approve text;
  v_is_existing boolean;
  v_is_pre_registered boolean := false;
  v_membership_status text;
  v_member_func text;
BEGIN
  requested_role := lower(trim(coalesce(new.raw_user_meta_data ->> 'role', 'member')));

  IF requested_role NOT IN ('member', 'editor', 'admin') THEN
    requested_role := 'member';
  END IF;

  -- SECURITY FIX (#1): Never trust client-supplied admin/editor role without an active staff invite
  v_has_staff_invite := (
    requested_role IN ('editor', 'admin')
    AND public.can_register_staff(new.email, requested_role)
  );

  IF requested_role IN ('editor', 'admin') AND NOT v_has_staff_invite THEN
    requested_role := 'member';
  END IF;

  -- Check registration gates (separate Member and Executive toggles with global fallback)
  v_membership_status := coalesce(new.raw_user_meta_data ->> 'membership_status', 'existing');
  SELECT value INTO v_reg_enabled FROM system_settings WHERE key = 'registration_enabled';
  IF v_membership_status = 'executive' THEN
    SELECT coalesce((SELECT value FROM system_settings WHERE key = 'registration_enabled_executive'), v_reg_enabled, 'true') INTO v_reg_enabled;
  ELSE
    SELECT coalesce((SELECT value FROM system_settings WHERE key = 'registration_enabled_member'), v_reg_enabled, 'true') INTO v_reg_enabled;
  END IF;

  IF v_reg_enabled = 'false' THEN
    IF v_has_staff_invite THEN
      -- Allow invite-based staff even when general registration is closed
    ELSE
      RAISE EXCEPTION 'Registration is currently disabled for this applicant type by administrator.';
    END IF;
  END IF;

  -- Check existing membership / editorial review flag from registration metadata
  IF new.raw_user_meta_data ->> 'is_existing_member' = 'false'
     OR new.raw_user_meta_data ->> 'applicant_status' = 'pending_editor_review'
     OR v_membership_status = 'new' THEN
    v_is_existing := false;
  ELSE
    v_is_existing := true;
  END IF;

  v_preferred_name := nullif(trim(new.raw_user_meta_data ->> 'preferred_name'), '');

  -- Look up member by email to link their st_id and name
  SELECT st_id, name, coalesce(v_preferred_name, preferred_name)
  INTO v_st_id, v_name, v_preferred_name
  FROM members
  WHERE lower(email) = lower(new.email);

  v_is_pre_registered := (v_st_id IS NOT NULL);

  -- Determine status
  IF v_has_staff_invite THEN
    v_status := 'approved';
    IF v_st_id IS NULL THEN
      v_st_id := coalesce(nullif(new.raw_user_meta_data ->> 'st_id', ''), null);
    END IF;
  ELSIF v_st_id IS NOT NULL AND v_is_existing THEN
    v_status := 'approved';
  ELSIF NOT v_is_existing THEN
    v_status := 'pending_editor_review';
  ELSE
    IF v_membership_status = 'executive' THEN
      SELECT coalesce(
        (SELECT value FROM system_settings WHERE key = 'registration_auto_approve_executive'),
        (SELECT value FROM system_settings WHERE key = 'registration_auto_approve'),
        'false'
      ) INTO v_auto_approve;
    ELSE
      SELECT coalesce(
        (SELECT value FROM system_settings WHERE key = 'registration_auto_approve_member'),
        (SELECT value FROM system_settings WHERE key = 'registration_auto_approve'),
        'false'
      ) INTO v_auto_approve;
    END IF;

    IF v_auto_approve = 'true' AND requested_role = 'member' THEN
      v_status := 'approved';
    ELSE
      v_status := 'pending';
    END IF;
  END IF;

  -- Format Student ID
  IF v_st_id IS NULL THEN
    v_st_id := coalesce(new.raw_user_meta_data ->> 'st_id', '');
  END IF;

  IF v_name IS NULL THEN
    v_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  END IF;

  IF v_st_id IS NOT NULL AND v_st_id <> '' THEN
    v_st_id := trim(v_st_id);
    IF lower(v_st_id) LIKE 'sc/%' THEN
      v_st_id := 'SC/' || substring(v_st_id from 4);
    ELSE
      v_st_id := 'SC/' || v_st_id;
    END IF;
  END IF;

  -- Determine member function
  IF NOT v_is_existing THEN
    v_member_func := coalesce(nullif(new.raw_user_meta_data ->> 'member_function', ''), 'Pending Review');
  ELSE
    v_member_func := coalesce(nullif(new.raw_user_meta_data ->> 'member_function', ''), 'General');
  END IF;

  -- Insert or update members record
  IF v_st_id IS NOT NULL AND v_st_id <> '' THEN
    IF EXISTS (SELECT 1 FROM members WHERE lower(st_id) = lower(v_st_id)) THEN
      IF NOT v_is_pre_registered AND NOT (
        v_has_staff_invite
        AND EXISTS (
          SELECT 1 FROM members
          WHERE lower(st_id) = lower(v_st_id)
            AND (email IS NULL OR email = '' OR lower(email) = lower(new.email))
        )
      ) THEN
        RAISE EXCEPTION 'Student ID % is already registered to another member.', v_st_id;
      END IF;

      UPDATE members
      SET profile_image_url = coalesce(new.raw_user_meta_data ->> 'profile_image_url', members.profile_image_url),
          preferred_name = coalesce(v_preferred_name, members.preferred_name),
          st_position = coalesce(
            nullif(new.raw_user_meta_data ->> 'st_position', ''),
            nullif(new.raw_user_meta_data ->> 'executive_manager', ''),
            members.st_position
          ),
          member_function = coalesce(
            nullif(new.raw_user_meta_data ->> 'member_function', ''),
            members.member_function
          ),
          membership_status = v_membership_status,
          skills_assessment = (new.raw_user_meta_data -> 'skills_assessment')
      WHERE lower(st_id) = lower(v_st_id);
    ELSE
      INSERT INTO members (
        st_id, name, preferred_name, email, level, mobile_number, st_position, member_function, profile_image_url, membership_status, skills_assessment
      )
      VALUES (
        v_st_id,
        v_name,
        v_preferred_name,
        lower(new.email),
        coalesce(nullif(new.raw_user_meta_data ->> 'level', ''), '1')::integer,
        new.raw_user_meta_data ->> 'mobile_number',
        coalesce(
          nullif(new.raw_user_meta_data ->> 'st_position', ''),
          nullif(new.raw_user_meta_data ->> 'executive_manager', ''),
          CASE WHEN v_status = 'approved' THEN 'Member' ELSE 'Pending Review' END
        ),
        v_member_func,
        new.raw_user_meta_data ->> 'profile_image_url',
        v_membership_status,
        (new.raw_user_meta_data -> 'skills_assessment')
      );
    END IF;
  END IF;

  -- Insert or update profiles record
  INSERT INTO profiles (
    id, email, full_name, preferred_name, role, st_id, status, membership_status, skills_assessment, portfolio_url, contribution_note
  )
  VALUES (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), v_name),
    v_preferred_name,
    requested_role,
    v_st_id,
    v_status,
    v_membership_status,
    (new.raw_user_meta_data -> 'skills_assessment'),
    new.raw_user_meta_data ->> 'portfolio_url',
    new.raw_user_meta_data ->> 'contribution_note'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email,
        full_name = excluded.full_name,
        preferred_name = excluded.preferred_name,
        role = excluded.role,
        st_id = excluded.st_id,
        status = excluded.status,
        membership_status = excluded.membership_status,
        skills_assessment = excluded.skills_assessment,
        portfolio_url = excluded.portfolio_url,
        contribution_note = excluded.contribution_note,
        updated_at = now();

  IF v_has_staff_invite THEN
    UPDATE access_invites
    SET used_at = now()
    WHERE lower(email) = lower(new.email)
      AND role = requested_role
      AND used_at IS NULL;
  END IF;

  RETURN new;
END;
$$;


-- ------------------------------------------------------------------------------
-- #2. Lock status, st_id, role, email, and membership_status on public.profiles
-- ------------------------------------------------------------------------------

-- SECURITY INVOKER trigger: when a direct client updates profiles via PostgREST,
-- current_user is 'authenticated' (or 'anon'), so this guard always runs.
-- Trusted SECURITY DEFINER triggers/RPCs owned by postgres run as 'postgres'
-- and service_role runs as 'service_role', so legitimate server flows continue working.
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  v_actor_role := public.current_app_role();

  -- Only approved admins may change a user's role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF v_actor_role <> 'admin' THEN
      RAISE EXCEPTION 'Forbidden: Only approved administrators can modify user roles.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Only approved staff (admin/editor) may change status, st_id, email, or membership_status
  IF (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.st_id IS DISTINCT FROM OLD.st_id)
     OR (lower(COALESCE(NEW.email, '')) IS DISTINCT FROM lower(COALESCE(OLD.email, '')))
     OR (NEW.membership_status IS DISTINCT FROM OLD.membership_status) THEN
    IF v_actor_role NOT IN ('admin', 'editor') THEN
      RAISE EXCEPTION 'Forbidden: You cannot modify account status, Student ID, email, or membership status.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Prevent anyone from reassigning a profile row's primary key id
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Forbidden: Profile ID cannot be modified.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- Tighten INSERT and UPDATE RLS policies on profiles
DROP POLICY IF EXISTS "profiles insert own" ON public.profiles;
CREATE POLICY "profiles insert own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  id = (SELECT auth.uid())
  AND lower(email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
  AND st_id IS NULL
  AND (
    (role = 'member' AND status IN ('pending', 'pending_editor_review'))
    OR (role IN ('editor', 'admin') AND public.can_register_staff(email, role) AND status = 'approved')
  )
);

DROP POLICY IF EXISTS "profiles update own or admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles update staff or own" ON public.profiles;
CREATE POLICY "profiles update staff or own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()) OR public.is_staff())
WITH CHECK (id = (SELECT auth.uid()) OR public.is_staff());

-- Safe server-side RPC to sync blank profiles.st_id from the members row matching
-- the caller's verified auth.users email (replaces insecure direct client update in App.jsx)
CREATE OR REPLACE FUNCTION public.sync_own_profile_st_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_email text;
  v_existing_st_id text;
  v_member_st_id text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT lower(trim(u.email)), nullif(trim(p.st_id), '')
  INTO v_auth_email, v_existing_st_id
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_uid;

  IF v_existing_st_id IS NOT NULL THEN
    RETURN v_existing_st_id;
  END IF;

  IF v_auth_email IS NULL OR v_auth_email = '' THEN
    RETURN NULL;
  END IF;

  SELECT nullif(trim(m.st_id), '')
  INTO v_member_st_id
  FROM public.members m
  WHERE lower(trim(m.email)) = v_auth_email
  LIMIT 1;

  IF v_member_st_id IS NOT NULL THEN
    UPDATE public.profiles
    SET st_id = v_member_st_id,
        updated_at = now()
    WHERE id = v_uid
      AND (st_id IS NULL OR trim(st_id) = '');
  END IF;

  RETURN v_member_st_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_own_profile_st_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_own_profile_st_id() TO authenticated;


-- ------------------------------------------------------------------------------
-- #3. Lock down event_registrations RLS & require server-signed QR tokens
-- ------------------------------------------------------------------------------

-- Create private non-exposed schema for HMAC signing key & verifier
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.qr_signing_secrets (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.qr_signing_secrets FROM PUBLIC, anon, authenticated;

INSERT INTO private.qr_signing_secrets (id, secret)
VALUES (1, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- Internal verifier (never directly callable by anon/authenticated)
CREATE OR REPLACE FUNCTION private.verify_attendance_qr_token(
  p_event_id text,
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
STABLE
AS $$
DECLARE
  v_parts text[];
  v_exp bigint;
  v_sig text;
  v_now_block bigint;
  v_secret text;
  v_expected_sig text;
BEGIN
  IF p_event_id IS NULL OR trim(p_event_id) = '' OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN false;
  END IF;

  -- Token format: "<unix_minute_block>.<hmac_sha256_hex>"
  v_parts := string_to_array(trim(p_token), '.');
  IF array_length(v_parts, 1) <> 2 THEN
    RETURN false;
  END IF;

  BEGIN
    v_exp := v_parts[1]::bigint;
  EXCEPTION
    WHEN others THEN
      RETURN false;
  END;

  v_sig := lower(v_parts[2]);

  -- Verify expiry (allow +/- 2 minutes of clock/scan margin)
  v_now_block := floor(extract(epoch from now()) / 60)::bigint;
  IF abs(v_now_block - v_exp) > 2 THEN
    RETURN false;
  END IF;

  -- Ensure event exists
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE event_id = trim(p_event_id)) THEN
    RETURN false;
  END IF;

  SELECT secret INTO v_secret FROM private.qr_signing_secrets WHERE id = 1;
  IF v_secret IS NULL THEN
    RETURN false;
  END IF;

  v_expected_sig := encode(
    extensions.hmac(
      convert_to(trim(p_event_id) || ':' || v_exp::text, 'utf8'),
      convert_to(v_secret, 'utf8'),
      'sha256'
    ),
    'hex'
  );

  RETURN v_sig = lower(v_expected_sig);
END;
$$;

REVOKE ALL ON FUNCTION private.verify_attendance_qr_token(text, text) FROM PUBLIC, anon, authenticated;

-- Staff-only RPC to mint a server-signed rotating QR token
CREATE OR REPLACE FUNCTION public.generate_attendance_qr_token(p_event_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_event_id text := trim(coalesce(p_event_id, ''));
  v_exp bigint;
  v_secret text;
  v_sig text;
  v_token text;
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

  v_exp := floor(extract(epoch from now()) / 60)::bigint;
  v_sig := encode(
    extensions.hmac(
      convert_to(v_event_id || ':' || v_exp::text, 'utf8'),
      convert_to(v_secret, 'utf8'),
      'sha256'
    ),
    'hex'
  );
  v_token := v_exp::text || '.' || v_sig;

  RETURN jsonb_build_object(
    'token', v_token,
    'event_id', v_event_id,
    'exp', v_exp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_attendance_qr_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_attendance_qr_token(text) TO authenticated;

-- Public verifier RPC used by ScanAttendance.jsx on load
CREATE OR REPLACE FUNCTION public.verify_attendance_qr_token(
  p_event_id text,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
STABLE
AS $$
DECLARE
  v_event record;
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

REVOKE ALL ON FUNCTION public.verify_attendance_qr_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_attendance_qr_token(text, text) TO anon, authenticated;

-- Lock down public.event_registrations RLS policies
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow public insert for registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow public update for registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow public delete for registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "staff manage event_registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "member read own event_registrations" ON public.event_registrations;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_registrations FROM anon;

CREATE POLICY "staff manage event_registrations"
ON public.event_registrations
FOR ALL
TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE POLICY "member read own event_registrations"
ON public.event_registrations
FOR SELECT
TO authenticated
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

-- Drop legacy unauthenticated overloads so attackers cannot invoke old signatures
DROP FUNCTION IF EXISTS public.search_registration_by_id(varchar, varchar);
DROP FUNCTION IF EXISTS public.check_member_by_id(varchar);
DROP FUNCTION IF EXISTS public.record_csv_scan_attendance(varchar, varchar, boolean, varchar, varchar, varchar, varchar, varchar);

-- Hardened search_registration_by_id: requires staff OR valid server-signed QR token;
-- masks email and phone for non-staff check-in callers
CREATE OR REPLACE FUNCTION public.search_registration_by_id(
  p_event_id varchar(50),
  p_st_id varchar(50),
  p_token text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  event_id varchar(50),
  st_id varchar(50),
  name varchar(255),
  email varchar(255),
  phone varchar(50),
  degree_program varchar(255),
  level varchar(50),
  attend varchar(10),
  is_member boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_is_staff boolean := public.is_staff();
  v_normalized_st_id varchar(50);
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

REVOKE ALL ON FUNCTION public.search_registration_by_id(varchar, varchar, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_registration_by_id(varchar, varchar, text) TO anon, authenticated;

-- Hardened check_member_by_id: requires staff OR valid server-signed QR token
CREATE OR REPLACE FUNCTION public.check_member_by_id(
  p_st_id varchar(50),
  p_event_id varchar(50) DEFAULT NULL,
  p_token text DEFAULT NULL
)
RETURNS TABLE (
  exists_member boolean,
  st_id varchar(50),
  name varchar(255),
  level varchar(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_normalized_st_id varchar(50);
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
    m.level::varchar(50)
  FROM public.members m
  WHERE lower(trim(regexp_replace(m.st_id, '^sc\/', '', 'i'))) = v_normalized_st_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.check_member_by_id(varchar, varchar, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_member_by_id(varchar, varchar, text) TO anon, authenticated;

-- Hardened record_csv_scan_attendance: requires staff OR valid server-signed QR token;
-- never trusts client-supplied p_is_member to write into public.attendance
CREATE OR REPLACE FUNCTION public.record_csv_scan_attendance(
  p_event_id varchar(50),
  p_st_id varchar(50),
  p_is_member boolean DEFAULT false,
  p_name varchar(255) DEFAULT NULL,
  p_email varchar(255) DEFAULT NULL,
  p_phone varchar(50) DEFAULT NULL,
  p_degree_program varchar(255) DEFAULT NULL,
  p_level varchar(50) DEFAULT NULL,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_member_exists boolean;
  v_reg_exists boolean;
  v_normalized_st_id varchar(50);
  v_actual_st_id varchar(50);
  v_final_name varchar(255);
BEGIN
  IF NOT public.is_staff() AND NOT private.verify_attendance_qr_token(p_event_id, p_token) THEN
    RAISE EXCEPTION 'Unauthorized: This QR code is invalid or expired. Please scan the live QR code.'
      USING ERRCODE = '42501';
  END IF;

  v_normalized_st_id := lower(trim(regexp_replace(coalesce(p_st_id, ''), '^sc\/', '', 'i')));
  IF v_normalized_st_id = '' THEN
    RAISE EXCEPTION 'Student ID is required.';
  END IF;

  -- Verify member existence authoritatively in primary members database
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
      SELECT name INTO v_final_name
      FROM public.members
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

  -- Only record into main attendance table if verified as a society member in public.members
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

REVOKE ALL ON FUNCTION public.record_csv_scan_attendance(varchar, varchar, boolean, varchar, varchar, varchar, varchar, varchar, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_csv_scan_attendance(varchar, varchar, boolean, varchar, varchar, varchar, varchar, varchar, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
