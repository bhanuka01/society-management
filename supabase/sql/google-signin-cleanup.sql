-- RPC to clean up an unregistered Google OAuth user so they can register later with the same email.
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.cleanup_unregistered_google_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_role text;
  v_profile_st_id text;
  v_member_st_id text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(trim(coalesce(u.email, ''))), p.role, trim(coalesce(p.st_id, ''))
  INTO v_email, v_role, v_profile_st_id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_uid;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN false;
  END IF;

  -- Never delete staff accounts or invited staff
  IF coalesce(v_role, 'member') IN ('admin', 'editor') THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.access_invites
    WHERE lower(trim(email)) = v_email
  ) THEN
    RETURN false;
  END IF;

  -- Check if this email has a matching registered member record
  SELECT trim(coalesce(m.st_id, ''))
  INTO v_member_st_id
  FROM public.members m
  WHERE lower(trim(m.email)) = v_email
  LIMIT 1;

  -- If email is registered in members and profile st_id matches (or is blank awaiting sync), keep the user
  IF v_member_st_id IS NOT NULL AND v_member_st_id <> '' THEN
    IF v_profile_st_id = '' OR lower(v_profile_st_id) = lower(v_member_st_id) THEN
      RETURN false;
    END IF;
  END IF;

  -- Remove orphan profile and auth user so the person can register normally
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_unregistered_google_user() TO authenticated;

-- RPC to distinguish unregistered emails vs incorrect passwords on email/password login.
CREATE OR REPLACE FUNCTION public.check_login_email_status(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_exists boolean := false;
  v_has_password boolean := false;
BEGIN
  IF v_email = '' THEN
    RETURN 'not_registered';
  END IF;

  SELECT true, (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '')
  INTO v_user_exists, v_has_password
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_email
  LIMIT 1;

  IF NOT coalesce(v_user_exists, false) THEN
    RETURN 'not_registered';
  END IF;

  -- Treat orphan empty Google profiles with no registered member/staff record as unregistered
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(trim(p.email)) = v_email
      AND (p.role IN ('admin', 'editor') OR nullif(trim(p.st_id), '') IS NOT NULL)
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE lower(trim(m.email)) = v_email
      AND nullif(trim(m.st_id), '') IS NOT NULL
  ) THEN
    RETURN 'not_registered';
  END IF;

  IF coalesce(v_has_password, false) THEN
    RETURN 'password_registered';
  END IF;

  RETURN 'google_only';
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_email_status(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
