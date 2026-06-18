-- ============================================================================
-- Migration 020: Brand-DNA Soul Ledger (rung U2 — the "Soul ledger" / moat)
-- ============================================================================
-- The persistence foundation for the capability-aware engine
-- (see docs/01-CAPABILITY-ENGINE-RESPEC.md §U2 + docs/brand-dna-dropfly.md):
--
--   1. brand_souls       — per-tenant Brand DNA + Higgsfield binding ids the
--                          engine injects (soul / brand_kit / style / elements).
--   2. soul_memory       — append-only per-post performance ledger the learning
--                          loop mines (the endogenous flywheel).
--   3. generation_jobs   — async HF job tracking + credit accounting + an
--                          idempotency key so cron retries never double-spend.
--
-- Conventions copied from 011/015/018/019:
--   * Owner mechanism = user_id UUID NOT NULL REFERENCES auth.users(id)
--     ON DELETE CASCADE, with RLS `auth.uid() = user_id` (same as every other
--     tenant table — no new tenancy model invented).
--   * uuid PKs via gen_random_uuid(); TIMESTAMPTZ created_at/updated_at DEFAULT NOW().
--   * All `CREATE ... IF NOT EXISTS` / `DROP POLICY IF EXISTS` → idempotent,
--     safe to re-run.
--   * Engine writers run under the service role (getSupabase() uses the service
--     key), so each table also gets a "Service role full access" FOR ALL policy
--     mirroring 018_credit_system.sql.
-- ============================================================================

-- ============================================================================
-- 1. brand_souls — per-tenant Brand DNA (round-trips brand-dna-dropfly.md)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brand_souls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_profile_id UUID REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  brand_name TEXT NOT NULL,
  tagline TEXT,
  one_liner TEXT,
  positioning TEXT,
  voice JSONB NOT NULL DEFAULT '{}',            -- { tone[], do[], dont[] }
  visual JSONB NOT NULL DEFAULT '{}',           -- { background, text, brand_gradient[], aesthetic[], avoid[] }
  platform_policy JSONB NOT NULL DEFAULT '{}',  -- { primary[], secondary[], post_cadence_target, ai_disclosure }
  content_pillars JSONB NOT NULL DEFAULT '[]',  -- string[]
  audience JSONB NOT NULL DEFAULT '[]',         -- string[]
  -- Higgsfield binding ids the engine injects (the moat primitives).
  hf_soul_id TEXT,                              -- trained digital-twin id (soul_2 / soul_cinematic)
  hf_brand_kit_id TEXT,                         -- brand_kit_id (logo/colors/fonts/tone)
  hf_brand_kit_style_id TEXT,                   -- ms_image style_id (REQUIRED by ms_image DTC ads)
  hf_reference_element_ids JSONB NOT NULL DEFAULT '[]',  -- string[] of <<<element_id>>> (Soul-still-as-Reference path)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_souls_user ON public.brand_souls(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_souls_brand_profile ON public.brand_souls(brand_profile_id) WHERE brand_profile_id IS NOT NULL;

ALTER TABLE public.brand_souls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own brand souls" ON public.brand_souls;
CREATE POLICY "Users can view own brand souls" ON public.brand_souls
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own brand souls" ON public.brand_souls;
CREATE POLICY "Users can insert own brand souls" ON public.brand_souls
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own brand souls" ON public.brand_souls;
CREATE POLICY "Users can update own brand souls" ON public.brand_souls
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own brand souls" ON public.brand_souls;
CREATE POLICY "Users can delete own brand souls" ON public.brand_souls
  FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access brand_souls" ON public.brand_souls;
CREATE POLICY "Service role full access brand_souls" ON public.brand_souls
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. generation_jobs — async HF job tracking + credit accounting + idempotency
--    (defined BEFORE soul_memory because soul_memory.generation_job_id FKs it)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_soul_id UUID REFERENCES public.brand_souls(id) ON DELETE SET NULL,
  capability TEXT NOT NULL,                     -- capability-first: e.g. persona_consistent_image
  engine TEXT NOT NULL DEFAULT 'higgsfield',
  tool TEXT,                                    -- standalone HF tool (reframe/upscale/...) when not a model
  model TEXT,                                   -- concrete model id (nano_banana_pro / seedance_2_0 / ...)
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', '3d')),
  hf_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  params JSONB NOT NULL DEFAULT '{}',
  result_url TEXT,
  hf_credits_spent NUMERIC,
  error TEXT,
  idempotency_key TEXT,                         -- hash(userId+prompt+model+minute-bucket); cron retries must not double-spend
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE so a cron retry with the same idempotency_key upserts instead of double-spending.
CREATE UNIQUE INDEX IF NOT EXISTS uq_generation_jobs_idempotency_key
  ON public.generation_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_hf_job ON public.generation_jobs(hf_job_id) WHERE hf_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generation_jobs_owner_created ON public.generation_jobs(user_id, created_at DESC);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own generation jobs" ON public.generation_jobs;
CREATE POLICY "Users can view own generation jobs" ON public.generation_jobs
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own generation jobs" ON public.generation_jobs;
CREATE POLICY "Users can insert own generation jobs" ON public.generation_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access generation_jobs" ON public.generation_jobs;
CREATE POLICY "Service role full access generation_jobs" ON public.generation_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. soul_memory — append-only per-post performance ledger (the learning loop mines this)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.soul_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_soul_id UUID NOT NULL REFERENCES public.brand_souls(id) ON DELETE CASCADE,
  generation_job_id UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  niche TEXT,
  format TEXT,
  hook_type TEXT,
  opener TEXT,
  audio_id TEXT,
  caption_style TEXT,
  length_seconds NUMERIC,
  post_time TIMESTAMPTZ,
  capability TEXT,                              -- which capability produced it (engine is capability-first)
  model TEXT,                                   -- concrete HF model id
  metrics JSONB NOT NULL DEFAULT '{}',          -- { views, watch_time, retention, likes, comments, shares, saves, clicks, conversions }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soul_memory_owner_platform_created ON public.soul_memory(user_id, platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soul_memory_brand_soul ON public.soul_memory(brand_soul_id);

ALTER TABLE public.soul_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own soul memory" ON public.soul_memory;
CREATE POLICY "Users can view own soul memory" ON public.soul_memory
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own soul memory" ON public.soul_memory;
CREATE POLICY "Users can insert own soul memory" ON public.soul_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access soul_memory" ON public.soul_memory;
CREATE POLICY "Service role full access soul_memory" ON public.soul_memory
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- updated_at auto-touch trigger (idempotent shared function)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_brand_souls_updated_at ON public.brand_souls;
CREATE TRIGGER trg_brand_souls_updated_at
  BEFORE UPDATE ON public.brand_souls
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_generation_jobs_updated_at ON public.generation_jobs;
CREATE TRIGGER trg_generation_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.brand_souls IS 'Per-tenant Brand DNA + Higgsfield binding ids (soul/brand_kit/style/elements) the capability engine injects — rung U2 moat.';
COMMENT ON TABLE public.soul_memory IS 'Append-only per-post performance ledger; the learning/trend loop mines this (endogenous flywheel).';
COMMENT ON TABLE public.generation_jobs IS 'Async Higgsfield job tracking + credit accounting + idempotency_key so cron retries never double-spend.';
