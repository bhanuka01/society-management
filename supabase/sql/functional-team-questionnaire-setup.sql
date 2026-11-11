-- SQL Setup for ADSS Registration Placement & Skills Assessment
-- Run this script in Supabase SQL Editor (supabase.com -> SQL Editor)

-- 1. Ensure status check constraint on profiles allows 'pending_editor_review'
DO $$
BEGIN
  -- Drop existing status check constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_status_check' 
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_status_check;
  END IF;
END $$;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('pending', 'pending_editor_review', 'approved', 'rejected'));

-- 2. Add columns to profiles for registration status and skills assessment
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'existing';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS skills_assessment JSONB;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS contribution_note TEXT;

-- 3. Add columns to members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'existing';

ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS skills_assessment JSONB;

-- 4. Update handle_new_user() trigger to process questionnaire metadata
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
  v_is_existing boolean;
  v_membership_status text;
  v_member_func text;
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

  -- Check existing membership flag from registration questionnaire
  v_membership_status := coalesce(new.raw_user_meta_data ->> 'membership_status', 'existing');
  IF new.raw_user_meta_data ->> 'is_existing_member' = 'false' OR v_membership_status = 'new' THEN
    v_is_existing := false;
  ELSE
    v_is_existing := true;
  END IF;

  -- Look up member by email to link their st_id and name
  SELECT st_id, name INTO v_st_id, v_name
  FROM members
  WHERE lower(email) = lower(new.email);

  -- Determine status:
  -- Staff invites are auto-approved
  -- Existing members with pre-registered email are approved
  -- New applicants who answered 'No' are ALWAYS 'pending_editor_review'
  IF (requested_role IN ('editor', 'admin') AND public.can_register_staff(new.email, requested_role)) THEN
    v_status := 'approved';
    IF v_st_id IS NULL THEN
      v_st_id := coalesce(nullif(new.raw_user_meta_data ->> 'st_id', ''), null);
    END IF;
  ELSIF v_st_id IS NOT NULL AND v_is_existing THEN
    v_status := 'approved';
  ELSIF NOT v_is_existing THEN
    -- New applicants never auto-approve; require editor review
    v_status := 'pending_editor_review';
  ELSE
    -- Check system setting for auto-approval for general existing members
    SELECT value INTO v_auto_approve FROM system_settings WHERE key = 'registration_auto_approve';
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
    v_member_func := 'Pending Review';
  ELSE
    v_member_func := coalesce(nullif(new.raw_user_meta_data ->> 'member_function', ''), 'General');
  END IF;

  -- Insert or update members record
  IF v_st_id IS NOT NULL AND v_st_id <> '' THEN
    IF EXISTS (SELECT 1 FROM members WHERE lower(st_id) = lower(v_st_id)) THEN
      UPDATE members
      SET profile_image_url = coalesce(new.raw_user_meta_data ->> 'profile_image_url', members.profile_image_url),
          membership_status = v_membership_status,
          skills_assessment = (new.raw_user_meta_data -> 'skills_assessment')
      WHERE lower(st_id) = lower(v_st_id);
    ELSE
      INSERT INTO members (
        st_id, name, email, level, mobile_number, st_position, member_function, profile_image_url, membership_status, skills_assessment
      )
      VALUES (
        v_st_id,
        v_name,
        lower(new.email),
        coalesce(nullif(new.raw_user_meta_data ->> 'level', ''), '1')::integer,
        new.raw_user_meta_data ->> 'mobile_number',
        CASE WHEN v_status = 'approved' THEN 'Member' ELSE 'Pending Review' END,
        v_member_func,
        new.raw_user_meta_data ->> 'profile_image_url',
        v_membership_status,
        (new.raw_user_meta_data -> 'skills_assessment')
      );
    END IF;
  END IF;

  -- Insert or update profiles record
  INSERT INTO profiles (
    id, email, full_name, role, st_id, status, membership_status, skills_assessment, portfolio_url, contribution_note
  )
  VALUES (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), v_name),
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
        role = excluded.role,
        st_id = excluded.st_id,
        status = excluded.status,
        membership_status = excluded.membership_status,
        skills_assessment = excluded.skills_assessment,
        portfolio_url = excluded.portfolio_url,
        contribution_note = excluded.contribution_note,
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
