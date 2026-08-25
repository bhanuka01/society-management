-- SQL Setup for registration review and admin controls
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)

-- 1. Create system_settings table to store admin configurations
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed setting (default registration enabled)
INSERT INTO system_settings (key, value)
VALUES ('registration_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Seed auto-approve setting (default disabled)
INSERT INTO system_settings (key, value)
VALUES ('registration_auto_approve', 'false')
ON CONFLICT (key) DO NOTHING;

-- 2. Add status column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- 3. Enable RLS and setup policies for system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read system_settings" ON system_settings;
CREATE POLICY "public read system_settings" ON system_settings 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin update system_settings" ON system_settings;
CREATE POLICY "admin update system_settings" ON system_settings 
FOR UPDATE TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin insert system_settings" ON system_settings;
CREATE POLICY "admin insert system_settings" ON system_settings 
FOR INSERT TO authenticated 
WITH CHECK (public.is_admin());

-- 4. Update profiles policies to allow staff to update/delete profiles
DROP POLICY IF EXISTS "profiles update own or admin" ON profiles;
DROP POLICY IF EXISTS "profiles update staff or own" ON profiles;
CREATE POLICY "profiles update staff or own" ON profiles 
FOR UPDATE TO authenticated
USING (id = auth.uid() or public.is_staff())
WITH CHECK (
  public.is_staff()
  OR (
    id = auth.uid()
    AND lower(email) = lower(auth.email())
    AND role = public.current_app_role()
  )
);

DROP POLICY IF EXISTS "profiles delete staff" ON profiles;
CREATE POLICY "profiles delete staff" ON profiles 
FOR DELETE TO authenticated
USING (public.is_staff());

-- 5. Re-create function handle_new_user to process pending approvals and registration toggles
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
    -- If staff registration is enabled for this email and role via access_invites, we still allow it
    IF requested_role IN ('editor', 'admin') AND public.can_register_staff(new.email, requested_role) THEN
      -- Allow invite-based staff
    ELSE
      RAISE EXCEPTION 'Registration is currently disabled by administrator.';
    END IF;
  END IF;

  -- Look up member by email to link their st_id and name
  SELECT st_id, name INTO v_st_id, v_name
  FROM members
  WHERE lower(email) = lower(new.email);

  -- Determine status:
  -- If email is in members table (v_st_id is not null) or they are invited staff, they are auto-approved.
  -- Otherwise, we check if auto-approve is enabled for regular members.
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

    -- Update existing member with profile image url if provided
    IF v_st_id IS NOT NULL AND new.raw_user_meta_data ->> 'profile_image_url' IS NOT NULL THEN
      UPDATE members
      SET profile_image_url = new.raw_user_meta_data ->> 'profile_image_url'
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

    -- Check if st_id is already in members table (fixed lower(st_id) bug)
    IF exists (SELECT 1 FROM members WHERE lower(st_id) = lower(v_st_id)) THEN
      RAISE EXCEPTION 'Student ID % is already registered.', v_st_id;
    END IF;

    -- Insert into members table
    INSERT INTO members (st_id, name, email, level, mobile_number, st_position, member_function, profile_image_url)
    VALUES (
      v_st_id,
      v_name,
      lower(new.email),
      coalesce(nullif(new.raw_user_meta_data ->> 'level', ''), '1')::integer,
      new.raw_user_meta_data ->> 'mobile_number',
      CASE WHEN v_status = 'approved' THEN 'Member' ELSE 'Pending Review' END,
      coalesce(nullif(new.raw_user_meta_data ->> 'member_function', ''), CASE WHEN v_status = 'approved' THEN 'General' ELSE 'Pending Review' END),
      new.raw_user_meta_data ->> 'profile_image_url'
    );
  END IF;

  INSERT INTO profiles (id, email, full_name, role, st_id, status)
  VALUES (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), v_name),
    requested_role,
    v_st_id,
    v_status
  )
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email,
        full_name = excluded.full_name,
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

NOTIFY pgrst, 'reload schema';

