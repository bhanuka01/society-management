-- 1. Update trigger to save profile_image_url
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
  IF v_st_id IS NOT NULL OR (requested_role IN ('editor', 'admin') AND public.can_register_staff(new.email, requested_role)) THEN
    v_status := 'approved';
    IF v_st_id IS NULL THEN
      v_st_id := coalesce(nullif(new.raw_user_meta_data ->> 'st_id', ''), null);
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
    SELECT value INTO v_auto_approve FROM system_settings WHERE key = 'registration_auto_approve';
    
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



-- Allow public uploads to profile_images bucket
CREATE POLICY "Allow public inserts" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'profile_images');

-- Allow public reading of objects
CREATE POLICY "Allow public select" ON storage.objects
FOR SELECT USING (bucket_id = 'profile_images');


--Go to your Supabase Dashboard → Storage:
--Make sure your bucket is named profile_images.