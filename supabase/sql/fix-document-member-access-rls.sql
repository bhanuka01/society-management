-- ==============================================================================
-- Migration: Fix Document Member Access & Row Level Security (RLS)
-- Fixes: Members assigned to document categories (e.g. Events) or with directly
-- assigned documents not being able to view or query files in Document section.
--
-- Instructions:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Navigate to "SQL Editor" on the left navigation bar
-- 3. Paste this entire script and click "Run" (Ctrl+Enter / Cmd+Enter)
-- ==============================================================================

-- 1. Drop dependent policies FIRST so functions can be cleanly dropped/replaced
DROP POLICY IF EXISTS "Officers can view all docs and members can view public docs" ON public.documents;
DROP POLICY IF EXISTS "Officers and authorized members can view docs" ON public.documents;

-- 2. Drop existing functions now that policies no longer depend on them
DROP FUNCTION IF EXISTS public.is_document_authorized();
DROP FUNCTION IF EXISTS public.is_document_authorized(text);

-- 3. Create robust, case-insensitive, whitespace-tolerant is_document_authorized function
CREATE OR REPLACE FUNCTION public.is_document_authorized(p_category text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_st_id text;
  v_email text;
  v_allowed jsonb;
  v_item text;
  v_key text;
  v_val jsonb;
  v_mem_cats jsonb := NULL;
  v_cat text;
BEGIN
  -- Officers (admin, editor) always have full access to all documents
  IF public.is_staff() THEN
    RETURN true;
  END IF;

  -- Resolve authenticated user's student ID and email from profiles
  SELECT st_id, email INTO v_st_id, v_email 
  FROM public.profiles 
  WHERE id = auth.uid();

  -- Fallback: If st_id is empty or null in profiles, resolve from members table via email
  IF (v_st_id IS NULL OR trim(v_st_id) = '') AND (v_email IS NOT NULL AND trim(v_email) != '') THEN
    SELECT st_id INTO v_st_id
    FROM public.members
    WHERE lower(trim(email)) = lower(trim(v_email))
    LIMIT 1;
  END IF;

  v_st_id := upper(trim(coalesce(v_st_id, '')));
  v_email := lower(trim(coalesce(v_email, '')));

  -- If neither student ID nor email can be determined, deny access
  IF v_st_id = '' AND v_email = '' THEN
    RETURN false;
  END IF;

  -- Retrieve document access settings
  SELECT value::jsonb INTO v_allowed
  FROM public.system_settings
  WHERE key = 'document_access_members';

  IF v_allowed IS NULL THEN
    RETURN false;
  END IF;

  -- Case A: Legacy format - JSON array of student IDs or emails ["SC/2022/...", ...]
  IF jsonb_typeof(v_allowed) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements_text(v_allowed) LOOP
      IF (v_st_id != '' AND upper(trim(v_item)) = v_st_id)
         OR (v_email != '' AND lower(trim(v_item)) = v_email) THEN
        RETURN true; -- User has access to all categories in legacy mode
      END IF;
    END LOOP;
    RETURN false;
  END IF;

  -- Case B: Granular Category Map format - { "SC/2022/...": ["Events", "Guidance"], ... }
  IF jsonb_typeof(v_allowed) = 'object' THEN
    FOR v_key, v_val IN SELECT * FROM jsonb_each(v_allowed) LOOP
      IF (v_st_id != '' AND upper(trim(v_key)) = v_st_id)
         OR (v_email != '' AND lower(trim(v_key)) = v_email) THEN
        v_mem_cats := v_val;
        EXIT;
      END IF;
    END LOOP;

    -- If user is not listed in document_access_members, deny access
    IF v_mem_cats IS NULL OR jsonb_typeof(v_mem_cats) != 'array' THEN
      RETURN false;
    END IF;

    -- If no specific category requested, check if user has access to at least 1 category
    IF p_category IS NULL OR trim(p_category) = '' THEN
      RETURN jsonb_array_length(v_mem_cats) > 0;
    END IF;

    -- Check if requested category is in member's permitted categories (case-insensitive)
    FOR v_cat IN SELECT * FROM jsonb_array_elements_text(v_mem_cats) LOOP
      IF lower(trim(v_cat)) = lower(trim(p_category)) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;

  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- 4. Provide 0-argument overload to ensure backward compatibility
CREATE OR REPLACE FUNCTION public.is_document_authorized()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_document_authorized(NULL::text);
$$;

-- 5. Create documents SELECT policy
CREATE POLICY "Officers and authorized members can view docs"
ON public.documents
FOR SELECT
TO authenticated
USING (
  public.is_staff()
  OR (
    -- 1. Document directly assigned to member via st_id (matches profile or member record)
    (
      st_id IS NOT NULL 
      AND (
        upper(trim(st_id)) = upper(trim(coalesce((SELECT p.st_id FROM public.profiles p WHERE p.id = auth.uid()), '')))
        OR upper(trim(st_id)) = upper(trim(coalesce((
          SELECT m.st_id FROM public.members m 
          JOIN public.profiles p ON lower(trim(m.email)) = lower(trim(p.email)) 
          WHERE p.id = auth.uid() LIMIT 1
        ), '')))
      )
    )
    -- 2. Document is marked public to members and caller is authorized for the category
    OR (
      visibility = 'public_to_members'
      AND public.is_document_authorized(category)
    )
  )
);

-- 6. Force PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
