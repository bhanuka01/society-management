-- ==============================================================================
-- Academic Cycles & AGM Tenure Management Setup
-- Stores society cycles and active AGM cycle configuration in system_settings
-- ==============================================================================

-- 1. Ensure system_settings table exists
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Seed initial academic cycles (2024/2025 active cycle and 2023/2024 past cycle)
INSERT INTO public.system_settings (key, value)
VALUES (
  'academic_cycles',
  '[{"id":"cycle-2024-2025","name":"2024/2025","startDate":"2024-01-01","endDate":"2025-12-31","isActive":true,"isVisible":true,"description":"ADSS Academic Cycle 2024/2025"},{"id":"cycle-2023-2024","name":"2023/2024","startDate":"2023-01-01","endDate":"2023-12-31","isActive":false,"isVisible":true,"description":"ADSS Academic Cycle 2023/2024"}]'
)
ON CONFLICT (key) DO NOTHING;

-- 3. Seed active cycle identifier
INSERT INTO public.system_settings (key, value)
VALUES ('active_cycle_id', 'cycle-2024-2025')
ON CONFLICT (key) DO NOTHING;

-- 4. Enable Row Level Security (if not already enabled)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Public read, Staff write
DROP POLICY IF EXISTS "public read system_settings" ON public.system_settings;
CREATE POLICY "public read system_settings" ON public.system_settings 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin update system_settings" ON public.system_settings;
CREATE POLICY "admin update system_settings" ON public.system_settings 
FOR UPDATE TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin insert system_settings" ON public.system_settings;
CREATE POLICY "admin insert system_settings" ON public.system_settings 
FOR INSERT TO authenticated 
WITH CHECK (public.is_admin());
