-- ============================================================================
-- Migration 015: Multi-Tenant Security Hardening
-- ============================================================================
-- Fixes:
--   1. Revoke GRANT ALL to anon (from migration 009)
--   2. Fix overly permissive RLS INSERT/ALL policies
--   3. Add RLS to content_calendars, autopilot_runs, brand_kits
--   4. Create brand_assets table with RLS
--   5. Drop dangerous exec_sql function
-- ============================================================================

-- ============================================================================
-- 1. REVOKE DANGEROUS PERMISSIONS
-- ============================================================================

-- Revoke the blanket GRANT ALL from migration 009
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Anon only needs schema usage (for Supabase auth to work)
GRANT USAGE ON SCHEMA public TO anon;

-- Authenticated users get scoped permissions (RLS enforces row-level access)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- 2. FIX OVERLY PERMISSIVE RLS POLICIES
-- ============================================================================

-- profiles: Remove open INSERT, add user-scoped INSERT
-- (The trigger function uses SECURITY DEFINER so it bypasses RLS)
DROP POLICY IF EXISTS "Enable insert for trigger" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- users: Same fix
DROP POLICY IF EXISTS "Enable insert for trigger" ON public.users;
CREATE POLICY "Users can insert own record" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Add SELECT/UPDATE policies for users table if missing
DROP POLICY IF EXISTS "Users can view own record" ON public.users;
CREATE POLICY "Users can view own record" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own record" ON public.users;
CREATE POLICY "Users can update own record" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- token_balances: Remove open INSERT, scope to own user_id
DROP POLICY IF EXISTS "Enable insert for trigger" ON public.token_balances;
CREATE POLICY "Users can insert own token balance" ON public.token_balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add SELECT policy for token_balances if missing
DROP POLICY IF EXISTS "Users can view own token balance" ON public.token_balances;
CREATE POLICY "Users can view own token balance" ON public.token_balances
  FOR SELECT USING (auth.uid() = user_id);

-- automation_executions: Remove open INSERT (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service can insert executions" ON public.automation_executions;

-- analytics_snapshots: Remove open INSERT
DROP POLICY IF EXISTS "Service can insert analytics" ON public.analytics_snapshots;

-- post_analytics: Remove the dangerous FOR ALL USING (true) policy
DROP POLICY IF EXISTS "Service can manage post analytics" ON public.post_analytics;

-- ============================================================================
-- 3. ADD RLS TO UNPROTECTED TABLES (from migration 014)
-- ============================================================================

-- content_calendars
ALTER TABLE public.content_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendars" ON public.content_calendars
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendars" ON public.content_calendars
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendars" ON public.content_calendars
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendars" ON public.content_calendars
  FOR DELETE USING (auth.uid() = user_id);

-- autopilot_runs
ALTER TABLE public.autopilot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own autopilot runs" ON public.autopilot_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own autopilot runs" ON public.autopilot_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- brand_kits
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brand kit" ON public.brand_kits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brand kit" ON public.brand_kits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brand kit" ON public.brand_kits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brand kit" ON public.brand_kits
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. CREATE brand_assets TABLE WITH RLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'logo', 'graphic', 'screenshot', 'template')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('brand', 'product', 'lifestyle', 'testimonial', 'event', 'general')),
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT,
  dimensions JSONB,
  tags TEXT[] DEFAULT '{}',
  product_name TEXT,
  platforms TEXT[],
  aspect_ratio TEXT,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_assets_user ON public.brand_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_assets_type ON public.brand_assets(user_id, type);
CREATE INDEX IF NOT EXISTS idx_brand_assets_category ON public.brand_assets(user_id, category);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON public.brand_assets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets" ON public.brand_assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.brand_assets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.brand_assets
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 5. DROP DANGEROUS exec_sql FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.exec_sql(text);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.brand_assets IS 'User media library — images, videos, logos for content creation';
