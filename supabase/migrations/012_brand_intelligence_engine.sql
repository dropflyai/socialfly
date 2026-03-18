-- SocialSync Empire - Brand Intelligence Engine Migration
-- Created: 2025-12-29
-- Purpose: Extended brand profiles for URL scanning, voice analysis, and autopilot

-- ============================================================================
-- EXTEND BRAND PROFILES (add Vision 2.0 fields)
-- ============================================================================
ALTER TABLE public.brand_profiles
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('website', 'instagram', 'facebook', 'manual')),
  ADD COLUMN IF NOT EXISTS voice_vocabulary TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS voice_personality JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS color_accent TEXT,
  ADD COLUMN IF NOT EXISTS font_heading TEXT,
  ADD COLUMN IF NOT EXISTS font_body TEXT,
  ADD COLUMN IF NOT EXISTS image_style TEXT CHECK (image_style IN ('minimal', 'bold', 'vintage', 'modern', 'corporate', 'playful', 'luxury', 'organic')),
  ADD COLUMN IF NOT EXISTS target_demographics JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_interests TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_pain_points TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_pillars TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS posting_schedule JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS competitor_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'complete', 'failed')),
  ADD COLUMN IF NOT EXISTS analysis_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_analysis JSONB DEFAULT '{}';

-- Index for finding brands by source URL
CREATE INDEX IF NOT EXISTS idx_brand_profiles_source_url ON public.brand_profiles(source_url) WHERE source_url IS NOT NULL;

-- ============================================================================
-- CONTENT SOURCES (for autopilot monitoring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'webpage', 'blog', 'youtube', 'podcast', 'manual')),
  source_url TEXT NOT NULL,
  source_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_content_at TIMESTAMPTZ,
  sync_frequency TEXT DEFAULT 'daily' CHECK (sync_frequency IN ('hourly', 'daily', 'weekly')),
  content_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_sources_user ON public.content_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_content_sources_brand ON public.content_sources(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_sources_active ON public.content_sources(is_active, last_synced_at);

-- ============================================================================
-- VIDEO PROJECTS (Cinema Studio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  -- Input
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'image', 'script', 'content_item')),
  input_text TEXT,
  input_image_url TEXT,
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  -- Model configuration
  model TEXT NOT NULL CHECK (model IN ('kling', 'minimax', 'runway', 'wan', 'sora', 'veo')),
  model_version TEXT,
  -- Camera and style
  camera_moves JSONB DEFAULT '[]',
  lens_type TEXT CHECK (lens_type IN ('wide', 'normal', 'telephoto', 'macro', 'fisheye')),
  style_preset TEXT,
  aspect_ratio TEXT DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9', '9:16', '1:1', '4:5', '4:3')),
  duration_seconds INT DEFAULT 5 CHECK (duration_seconds BETWEEN 1 AND 60),
  -- Output
  output_url TEXT,
  thumbnail_url TEXT,
  output_duration_ms INT,
  -- Status and metadata
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'generating', 'complete', 'failed')),
  progress INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_message TEXT,
  tokens_used INT DEFAULT 0,
  generation_time_ms INT,
  -- FAL.AI specific
  fal_request_id TEXT,
  fal_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_projects_user ON public.video_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_status ON public.video_projects(status);
CREATE INDEX IF NOT EXISTS idx_video_projects_brand ON public.video_projects(brand_id);

-- ============================================================================
-- AUTOPILOT CONFIGURATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.autopilot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  -- Content settings
  content_pillars TEXT[] DEFAULT '{}',
  content_types TEXT[] DEFAULT '{"text"}',
  platforms TEXT[] DEFAULT '{}',
  -- Schedule
  posts_per_week INT DEFAULT 7 CHECK (posts_per_week BETWEEN 1 AND 28),
  preferred_days TEXT[] DEFAULT '{"monday", "tuesday", "wednesday", "thursday", "friday"}',
  preferred_times JSONB DEFAULT '{}',
  -- Approval workflow
  approval_mode TEXT DEFAULT 'review_first' CHECK (approval_mode IN ('auto', 'review_first', 'review_optional')),
  notification_email TEXT,
  -- Generation tracking
  last_batch_at TIMESTAMPTZ,
  next_batch_at TIMESTAMPTZ,
  batch_size INT DEFAULT 7,
  total_generated INT DEFAULT 0,
  total_posted INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_autopilot_configs_user ON public.autopilot_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_configs_active ON public.autopilot_configs(is_active, next_batch_at);

-- ============================================================================
-- REPURPOSING JOBS (track 1→60 generation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.repurposing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  target_formats TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'partial', 'failed')),
  output_content_ids UUID[] DEFAULT '{}',
  formats_completed TEXT[] DEFAULT '{}',
  formats_failed JSONB DEFAULT '{}',
  total_tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_repurposing_jobs_user ON public.repurposing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_repurposing_jobs_status ON public.repurposing_jobs(status);

-- ============================================================================
-- BRAND ANALYSIS HISTORY (track URL scans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brand_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('full', 'voice', 'visual', 'audience', 'competitor')),
  -- Results
  voice_analysis JSONB,
  visual_analysis JSONB,
  audience_analysis JSONB,
  extracted_content JSONB,
  -- Metadata
  pages_analyzed INT DEFAULT 0,
  tokens_used INT DEFAULT 0,
  duration_ms INT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_analysis_history_brand ON public.brand_analysis_history(brand_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopilot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repurposing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_analysis_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Content Sources
CREATE POLICY "Users can view own sources" ON public.content_sources
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sources" ON public.content_sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON public.content_sources
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON public.content_sources
  FOR DELETE USING (auth.uid() = user_id);

-- Video Projects
CREATE POLICY "Users can view own videos" ON public.video_projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own videos" ON public.video_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON public.video_projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON public.video_projects
  FOR DELETE USING (auth.uid() = user_id);

-- Autopilot Configs
CREATE POLICY "Users can view own autopilot" ON public.autopilot_configs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own autopilot" ON public.autopilot_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own autopilot" ON public.autopilot_configs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own autopilot" ON public.autopilot_configs
  FOR DELETE USING (auth.uid() = user_id);

-- Repurposing Jobs
CREATE POLICY "Users can view own jobs" ON public.repurposing_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.repurposing_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.repurposing_jobs
  FOR UPDATE USING (auth.uid() = user_id);

-- Brand Analysis History
CREATE POLICY "Users can view own analysis" ON public.brand_analysis_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analysis" ON public.brand_analysis_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.content_sources IS 'External content sources for autopilot monitoring (RSS, blogs, etc)';
COMMENT ON TABLE public.video_projects IS 'Cinema Studio video generation projects';
COMMENT ON TABLE public.autopilot_configs IS 'Per-brand autopilot configuration and scheduling';
COMMENT ON TABLE public.repurposing_jobs IS 'Track content repurposing (1→60) jobs';
COMMENT ON TABLE public.brand_analysis_history IS 'History of brand URL analyses';
