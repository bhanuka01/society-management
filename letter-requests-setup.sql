-- SQL Setup for Letter Requests
-- Run this in your Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- 1. Create letter_requests table
CREATE TABLE IF NOT EXISTS public.letter_requests (
  id BIGSERIAL PRIMARY KEY,
  st_id VARCHAR(50) NOT NULL REFERENCES public.members(st_id) ON DELETE CASCADE,
  name_on_letter TEXT,
  selected_events TEXT[] DEFAULT '{}',
  additional_details TEXT,
  status TEXT NOT NULL DEFAULT 'not start' CHECK (status IN ('not start', 'inprogress', 'done', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed defaults for letter request config if not already present
INSERT INTO public.system_settings (key, value)
VALUES 
  ('letter_show_name', 'true'),
  ('letter_show_events', 'true'),
  ('letter_show_details', 'true')
ON CONFLICT (key) DO NOTHING;

-- 2. Enable RLS and setup policies for letter_requests
ALTER TABLE public.letter_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own letter requests" ON public.letter_requests;
CREATE POLICY "Users can read own letter requests" ON public.letter_requests
  FOR SELECT TO authenticated
  USING (
    st_id = (SELECT st_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "Users can insert own letter requests" ON public.letter_requests;
CREATE POLICY "Users can insert own letter requests" ON public.letter_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    st_id = (SELECT st_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can update letter requests" ON public.letter_requests;
CREATE POLICY "Staff can update letter requests" ON public.letter_requests
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can delete letter requests" ON public.letter_requests;
CREATE POLICY "Staff can delete letter requests" ON public.letter_requests
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- 3. MIGRATION FOR EXISTING TABLES:
-- If you already created the table, run these commands to update the check constraint to include 'rejected':
-- ALTER TABLE public.letter_requests DROP CONSTRAINT IF EXISTS letter_requests_status_check;
-- ALTER TABLE public.letter_requests ADD CONSTRAINT letter_requests_status_check CHECK (status IN ('not start', 'inprogress', 'done', 'rejected'));
