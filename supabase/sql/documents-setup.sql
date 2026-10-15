-- ==============================================================================
-- Migration: Document Management System Setup (Cloudflare R2 + Supabase Postgres)
-- Run this in your Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ==============================================================================

-- 1. Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('PDF', 'Word', 'Image', 'Archive', 'Other')),
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Events', 'Budgets', 'Permissions', 'Guidance')),
  r2_key TEXT NOT NULL UNIQUE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploader_name VARCHAR(255),
  uploaded_by_st_id VARCHAR(50) REFERENCES public.members(st_id) ON DELETE SET NULL,
  visibility VARCHAR(50) NOT NULL DEFAULT 'public_to_members' CHECK (visibility IN ('public_to_members', 'officers_only')),
  event_id VARCHAR(50) REFERENCES public.events(event_id) ON DELETE SET NULL,
  st_id VARCHAR(50) REFERENCES public.members(st_id) ON DELETE SET NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure existing documents table supports 'Archive'
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_file_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_file_type_check CHECK (file_type IN ('PDF', 'Word', 'Image', 'Archive', 'Other'));

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON public.documents(visibility);
CREATE INDEX IF NOT EXISTS idx_documents_event_id ON public.documents(event_id);
CREATE INDEX IF NOT EXISTS idx_documents_st_id ON public.documents(st_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON public.documents(file_type);

-- 3. Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.set_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_documents_updated_at();

-- 4. Seed system settings for Document Section Access (Admin-selected members)
INSERT INTO public.system_settings (key, value)
VALUES ('document_access_members', '[]')
ON CONFLICT (key) DO NOTHING;

-- 5. Helper function to verify if caller is an officer or an admin-selected member
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
  v_mem_cats jsonb;
BEGIN
  IF public.is_staff() THEN
    RETURN true;
  END IF;

  SELECT st_id, email INTO v_st_id, v_email FROM public.profiles WHERE id = auth.uid();

  SELECT value::jsonb INTO v_allowed
  FROM public.system_settings
  WHERE key = 'document_access_members';

  IF v_allowed IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Legacy format: JSON Array of student IDs or emails ["SC/2022/...", ...]
  IF jsonb_typeof(v_allowed) = 'array' THEN
    RETURN (v_st_id IS NOT NULL AND v_st_id != '' AND v_allowed ? v_st_id)
        OR (v_email IS NOT NULL AND v_email != '' AND v_allowed ? v_email);
  END IF;

  -- 2. Granular Category Map format: { "SC/2022/...": ["Guidance", "Permissions"], ... }
  IF jsonb_typeof(v_allowed) = 'object' THEN
    IF v_st_id IS NOT NULL AND v_st_id != '' AND v_allowed ? v_st_id THEN
      v_mem_cats := v_allowed -> v_st_id;
    ELSIF v_email IS NOT NULL AND v_email != '' AND v_allowed ? v_email THEN
      v_mem_cats := v_allowed -> v_email;
    ELSE
      RETURN false;
    END IF;

    -- If no category parameter provided, check if user has access to at least 1 category
    IF p_category IS NULL THEN
      RETURN jsonb_typeof(v_mem_cats) = 'array' AND jsonb_array_length(v_mem_cats) > 0;
    END IF;

    -- Check if requested category is in member's allowed categories array
    IF jsonb_typeof(v_mem_cats) = 'array' THEN
      RETURN v_mem_cats ? p_category;
    END IF;
  END IF;

  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- SELECT Policy:
-- - Society officers (admin, editor) can read all documents (including officers_only)
-- - Only admin-selected members can view documents in their permitted categories marked 'public_to_members'
DROP POLICY IF EXISTS "Officers can view all docs and members can view public docs" ON public.documents;
CREATE POLICY "Officers can view all docs and members can view public docs"
ON public.documents
FOR SELECT
TO authenticated
USING (
  public.is_staff()
  OR (
    visibility = 'public_to_members'
    AND public.is_document_authorized(category)
  )
);

-- INSERT Policy:
-- - Only authorized officers (admin, editor) can insert document records
DROP POLICY IF EXISTS "Only officers can insert documents" ON public.documents;
CREATE POLICY "Only officers can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_staff()
);

-- UPDATE Policy:
-- - Only authorized officers (admin, editor) can update document metadata
DROP POLICY IF EXISTS "Only officers can update documents" ON public.documents;
CREATE POLICY "Only officers can update documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- DELETE Policy:
-- - Only authorized officers (admin, editor) can delete documents
DROP POLICY IF EXISTS "Only officers can delete documents" ON public.documents;
CREATE POLICY "Only officers can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (public.is_staff());

-- 7. Total Storage Quota Guard (Ensure total repository storage does NOT exceed 9 GB)
CREATE OR REPLACE FUNCTION public.check_document_storage_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_size BIGINT;
  c_max_storage_bytes CONSTANT BIGINT := 9663676416; -- 9 GB (9 * 1024 * 1024 * 1024)
BEGIN
  -- Sum current file sizes excluding row being updated (if updating)
  SELECT COALESCE(SUM(file_size), 0) INTO v_total_size
  FROM public.documents
  WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (v_total_size + NEW.file_size) > c_max_storage_bytes THEN
    RAISE EXCEPTION 'Total document repository storage quota exceeded. Maximum allowed is 9 GB. Current usage: % bytes, new file: % bytes.',
      v_total_size, NEW.file_size;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_storage_limit ON public.documents;
CREATE TRIGGER trigger_check_storage_limit
  BEFORE INSERT OR UPDATE OF file_size ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.check_document_storage_limit();
