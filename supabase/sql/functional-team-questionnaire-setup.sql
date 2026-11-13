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

-- 3B. Seed separate Member and Executive registration gate & auto-approve keys
INSERT INTO public.system_settings (key, value)
VALUES
  ('registration_enabled_member', 'true'),
  ('registration_enabled_executive', 'true'),
  ('registration_auto_approve_member', 'false'),
  ('registration_auto_approve_executive', 'false')
ON CONFLICT (key) DO NOTHING;

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
  v_preferred_name varchar(255);
  v_status text;
  v_reg_enabled text;
  v_auto_approve text;
  v_is_existing boolean;
  v_is_pre_registered boolean := false;
  v_membership_status text;
  v_member_func text;
BEGIN
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'member');

  IF requested_role NOT IN ('member', 'editor', 'admin') THEN
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
    IF requested_role IN ('editor', 'admin') AND public.can_register_staff(new.email, requested_role) THEN
      -- Allow invite-based staff
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

  -- Determine status:
  -- Staff invites are auto-approved
  -- Existing members with pre-registered email are approved (unless requesting editorial review appeal)
  -- Appeals / new applicants always enter 'pending_editor_review'
  -- Otherwise check separate Executive vs Member auto-approve settings (with legacy fallback)
  IF (requested_role IN ('editor', 'admin') AND public.can_register_staff(new.email, requested_role)) THEN
    v_status := 'approved';
    IF v_st_id IS NULL THEN
      v_st_id := coalesce(nullif(new.raw_user_meta_data ->> 'st_id', ''), null);
    END IF;
  ELSIF v_st_id IS NOT NULL AND v_is_existing THEN
    v_status := 'approved';
  ELSIF NOT v_is_existing THEN
    -- Appeals / new applicants never auto-approve; require editor review
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
        requested_role IN ('editor', 'admin')
        AND public.can_register_staff(new.email, requested_role)
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

-- 5. Public helper RPC to count registered members per function for slot availability display
CREATE OR REPLACE FUNCTION public.get_function_member_counts()
RETURNS TABLE(function_name text, member_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    member_function AS function_name,
    COUNT(*)::bigint AS member_count
  FROM public.members
  WHERE member_function IS NOT NULL
    AND (level IS NULL OR level <= 4)
  GROUP BY member_function;
$$;

GRANT EXECUTE ON FUNCTION public.get_function_member_counts() TO anon, authenticated;

-- 6. Admin helper RPC & triggers to remove deleted members from Supabase Auth (auth.users)
CREATE OR REPLACE FUNCTION public.delete_member_and_auth_user(
  p_st_id text DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_email text;
  v_user_ids uuid[];
BEGIN
  IF v_caller_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_caller_id
      AND role IN ('admin', 'editor')
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators or staff can delete member accounts.';
  END IF;

  v_email := nullif(trim(coalesce(p_email, '')), '');

  IF v_email IS NULL AND nullif(trim(coalesce(p_st_id, '')), '') IS NOT NULL THEN
    SELECT nullif(trim(email), '') INTO v_email
    FROM public.members
    WHERE lower(st_id) = lower(trim(p_st_id))
    LIMIT 1;
  END IF;

  IF v_email IS NULL THEN
    SELECT nullif(trim(email), '') INTO v_email
    FROM public.profiles
    WHERE (p_profile_id IS NOT NULL AND id = p_profile_id)
       OR (nullif(trim(coalesce(p_st_id, '')), '') IS NOT NULL AND lower(st_id) = lower(trim(p_st_id)))
    LIMIT 1;
  END IF;

  SELECT coalesce(array_agg(DISTINCT target_id), ARRAY[]::uuid[])
  INTO v_user_ids
  FROM (
    SELECT p.id AS target_id
    FROM public.profiles p
    WHERE (p_profile_id IS NOT NULL AND p.id = p_profile_id)
       OR (nullif(trim(coalesce(p_st_id, '')), '') IS NOT NULL AND lower(p.st_id) = lower(trim(p_st_id)))
       OR (v_email IS NOT NULL AND lower(p.email) = lower(v_email))
    UNION
    SELECT u.id AS target_id
    FROM auth.users u
    WHERE (p_profile_id IS NOT NULL AND u.id = p_profile_id)
       OR (v_email IS NOT NULL AND lower(u.email) = lower(v_email))
       OR (
         nullif(trim(coalesce(p_st_id, '')), '') IS NOT NULL
         AND lower(coalesce(u.raw_user_meta_data ->> 'st_id', '')) = lower(trim(p_st_id))
       )
  ) AS matched
  WHERE target_id IS NOT NULL
    AND target_id <> v_caller_id;

  DELETE FROM public.members
  WHERE (nullif(trim(coalesce(p_st_id, '')), '') IS NOT NULL AND lower(st_id) = lower(trim(p_st_id)))
     OR (v_email IS NOT NULL AND lower(email) = lower(v_email));

  IF array_length(v_user_ids, 1) IS NOT NULL THEN
    DELETE FROM public.profiles
    WHERE id = ANY(v_user_ids);

    DELETE FROM auth.users
    WHERE id = ANY(v_user_ids);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_member_and_auth_user(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_member_deleted_auth_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_target_ids uuid[];
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  SELECT coalesce(array_agg(DISTINCT u.id), ARRAY[]::uuid[])
  INTO v_target_ids
  FROM auth.users u
  WHERE u.id <> v_caller_id
    AND (
      (OLD.email IS NOT NULL AND lower(u.email) = lower(OLD.email))
      OR (OLD.st_id IS NOT NULL AND lower(coalesce(u.raw_user_meta_data ->> 'st_id', '')) = lower(OLD.st_id))
      OR u.id IN (
        SELECT p.id
        FROM public.profiles p
        WHERE (OLD.st_id IS NOT NULL AND lower(p.st_id) = lower(OLD.st_id))
           OR (OLD.email IS NOT NULL AND lower(p.email) = lower(OLD.email))
      )
    );

  IF array_length(v_target_ids, 1) IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = ANY(v_target_ids);
    DELETE FROM auth.users WHERE id = ANY(v_target_ids);
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_member_deleted_cleanup_auth ON public.members;
CREATE TRIGGER on_member_deleted_cleanup_auth
BEFORE DELETE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.handle_member_deleted_auth_cleanup();

CREATE OR REPLACE FUNCTION public.handle_profile_deleted_auth_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF pg_trigger_depth() = 1
     AND OLD.id IS NOT NULL
     AND OLD.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
    DELETE FROM auth.users WHERE id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_deleted_cleanup_auth ON public.profiles;
CREATE TRIGGER on_profile_deleted_cleanup_auth
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_deleted_auth_cleanup();

-- 7. Public registration helper to verify a Student ID is not already taken
CREATE OR REPLACE FUNCTION public.check_st_id_available(p_st_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.members
    WHERE lower(st_id) = lower(trim(coalesce(p_st_id, '')))
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_st_id_available(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
