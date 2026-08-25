-- Migration: Setup Notices table with Row-Level Security (RLS)
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

CREATE TABLE IF NOT EXISTS public.notices (
    id VARCHAR(100) PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Select policy: Anyone (even anonymous guest users) can read public notices.
DROP POLICY IF EXISTS "Allow anyone to read notices" ON public.notices;
CREATE POLICY "Allow anyone to read notices" ON public.notices
    FOR SELECT USING (is_public = true OR auth.role() = 'authenticated');

-- Write policy: Only staff (editors/admins) can insert, update, or delete notices.
DROP POLICY IF EXISTS "Allow staff to write notices" ON public.notices;
CREATE POLICY "Allow staff to write notices" ON public.notices
    FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
