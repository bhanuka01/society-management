-- ==============================================================================
-- Fix v2: Remove ambiguous 0-arg overload of is_document_authorized and
-- make sure authenticated members can execute it.
-- Run in Supabase SQL Editor AFTER fix-document-member-access-rls.sql
-- ==============================================================================

-- The 0-arg overload conflicts with the (p_category text DEFAULT NULL) version:
-- any call like is_document_authorized() raised "Could not choose the best candidate function".
DROP POLICY IF EXISTS "Officers and authorized members can view docs" ON public.documents;
DROP FUNCTION IF EXISTS public.is_document_authorized();

GRANT EXECUTE ON FUNCTION public.is_document_authorized(text) TO authenticated;

CREATE POLICY "Officers and authorized members can view docs"
ON public.documents
FOR SELECT
TO authenticated
USING (
  public.is_staff()
  OR (
    (
      st_id IS NOT NULL
      AND upper(trim(st_id)) = upper(trim(coalesce((SELECT p.st_id FROM public.profiles p WHERE p.id = auth.uid()), '')))
    )
    OR (
      visibility = 'public_to_members'
      AND public.is_document_authorized(category)
    )
  )
);

NOTIFY pgrst, 'reload schema';

-- Diagnostics (read-only): which docs exist and how they are classified
SELECT category, visibility, count(*) AS files, min(created_at) AS oldest, max(created_at) AS newest
FROM public.documents
GROUP BY category, visibility
ORDER BY category;
