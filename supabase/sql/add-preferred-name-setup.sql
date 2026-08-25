-- ==============================================================================
-- Migration: Add Preferred Name Support to Members & Profiles
-- Run this in Supabase SQL Editor (https://supabase.com -> SQL Editor)
-- ==============================================================================

-- 1. Add preferred_name column to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(255);

-- 2. Add preferred_name column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_name TEXT;

-- 3. Add default setting for member preferred name self-edit permission
INSERT INTO system_settings (key, value)
VALUES ('member_edit_preferred_name', 'true')
ON CONFLICT (key) DO NOTHING;

-- 4. Update get_member_by_email function to include preferred_name
DROP FUNCTION IF EXISTS public.get_member_by_email(text);

CREATE OR REPLACE FUNCTION public.get_member_by_email(p_email text)
RETURNS TABLE (
  st_id VARCHAR(50), 
  name VARCHAR(255),
  preferred_name VARCHAR(255)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT st_id, name, preferred_name
  FROM members
  WHERE lower(email) = lower(p_email);
$$;

-- 5. Update handle_new_user() trigger function to handle preferred_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
  v_st_id varchar(50);
  v_name varchar(255);
  v_preferred_name varchar(255);
  v_status text;
  v_reg_enabled text;
  v_auto_approve text;
BEGIN
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'member');

  IF requested_role NOT IN ('member', 'editor', 'admin') THEN
    requested_role := 'member';
  END IF;

  -- Check if general registration is enabled
  SELECT value INTO v_reg_enabled FROM system_settings WHERE key = 'registration_enabled';
  IF v_reg_enabled = 'false' THEN
    IF requested_role IN ('editor', 'admin') AND public.can_register_staff(new.email, requested_role) THEN
      -- Allow invite-based staff
    ELSE
      RAISE EXCEPTION 'Registration is currently disabled by administrator.';
    END IF;
  END IF;

  -- Extract preferred name from metadata
  v_preferred_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'preferred_name'), ''), null);

  -- Look up member by email to link their st_id, name, and preferred_name
  SELECT st_id, name, preferred_name INTO v_st_id, v_name, v_preferred_name
  FROM members
  WHERE lower(email) = lower(new.email);

  -- Determine status
  IF v_st_id IS NOT NULL OR (requested_role IN ('editor', 'admin') AND public.can_register_staff(new.email, requested_role)) THEN
    v_status := 'approved';
    IF v_st_id IS NULL THEN
      v_st_id := coalesce(nullif(new.raw_user_meta_data ->> 'st_id', ''), null);
    END IF;
    IF v_st_id IS NOT NULL THEN
      v_st_id := trim(v_st_id);
      IF lower(v_st_id) LIKE 'sc/%' THEN
        v_st_id := 'SC/' || substring(v_st_id from 4);
      ELSE
        v_st_id := 'SC/' || v_st_id;
      END IF;
    END IF;
    IF v_name IS NULL THEN
      v_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email);
    END IF;
    IF v_preferred_name IS NULL THEN
      v_preferred_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'preferred_name'), ''), null);
    END IF;

    -- Update existing member with profile image and preferred_name if provided
    IF v_st_id IS NOT NULL THEN
      UPDATE members
      SET 
        profile_image_url = coalesce(new.raw_user_meta_data ->> 'profile_image_url', profile_image_url),
        preferred_name = coalesce(v_preferred_name, preferred_name)
      WHERE st_id = v_st_id;
    END IF;
  ELSE
    -- Check system setting for auto-approval
    SELECT value INTO v_auto_approve FROM system_settings WHERE key = 'registration_auto_approve';
    
    -- Only auto-approve if setting is true AND they are registering as a member
    IF v_auto_approve = 'true' AND requested_role = 'member' THEN
      v_status := 'approved';
    ELSE
      v_status := 'pending';
    END IF;

    v_st_id := coalesce(new.raw_user_meta_data ->> 'st_id', '');
    v_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
    v_preferred_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'preferred_name'), ''), null);
    
    IF v_st_id = '' OR v_st_id IS NULL THEN
      RAISE EXCEPTION 'Student ID is required for registration.';
    END IF;

    -- Normalize st_id to always start with 'SC/'
    v_st_id := trim(v_st_id);
    IF lower(v_st_id) LIKE 'sc/%' THEN
      v_st_id := 'SC/' || substring(v_st_id from 4);
    ELSE
      v_st_id := 'SC/' || v_st_id;
    END IF;

    -- Check if st_id is already in members table
    IF exists (SELECT 1 FROM members WHERE lower(st_id) = lower(v_st_id)) THEN
      RAISE EXCEPTION 'Student ID % is already registered.', v_st_id;
    END IF;

    -- Insert into members table
    INSERT INTO members (
      st_id, 
      name, 
      preferred_name,
      email, 
      level, 
      mobile_number, 
      st_position, 
      member_function, 
      profile_image_url
    )
    VALUES (
      v_st_id,
      v_name,
      v_preferred_name,
      lower(new.email),
      coalesce(nullif(new.raw_user_meta_data ->> 'level', ''), '1')::integer,
      new.raw_user_meta_data ->> 'mobile_number',
      CASE WHEN v_status = 'approved' THEN 'Member' ELSE 'Pending Review' END,
      coalesce(nullif(new.raw_user_meta_data ->> 'member_function', ''), CASE WHEN v_status = 'approved' THEN 'General' ELSE 'Pending Review' END),
      new.raw_user_meta_data ->> 'profile_image_url'
    );
  END IF;

  -- Insert or update profiles table
  INSERT INTO profiles (id, email, full_name, preferred_name, role, st_id, status)
  VALUES (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), v_name),
    v_preferred_name,
    requested_role,
    v_st_id,
    v_status
  )
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email,
        full_name = excluded.full_name,
        preferred_name = excluded.preferred_name,
        role = excluded.role,
        st_id = excluded.st_id,
        status = excluded.status,
        updated_at = now();

  IF requested_role IN ('editor', 'admin') AND public.can_register_staff(new.email, requested_role) THEN
    UPDATE access_invites
    SET used_at = now()
    WHERE lower(email) = lower(new.email)
      AND role = requested_role
      AND used_at is null;
  END IF;

  RETURN new;
END;
$$;

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
