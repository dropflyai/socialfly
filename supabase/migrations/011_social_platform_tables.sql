-- SocialSync Empire - Social Platform Tables Migration
-- Created: 2025-12-29
-- Purpose: Full social media automation engine schema

-- ============================================================================
-- PLATFORM CONNECTIONS (OAuth tokens for each social platform)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  profile_id TEXT,
  profile_name TEXT,
  profile_image_url TEXT,
  profile_handle TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disconnected', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_platform_connections_user ON public.platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_status ON public.platform_connections(status);

-- ============================================================================
-- BRAND PROFILES (for agencies managing multiple brands)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  color_primary TEXT DEFAULT '#6366F1',
  color_secondary TEXT DEFAULT '#8B5CF6',
  voice_tone TEXT DEFAULT 'professional' CHECK (voice_tone IN ('professional', 'casual', 'playful', 'authoritative', 'friendly', 'inspirational')),
  voice_description TEXT,
  target_audience TEXT,
  industry TEXT,
  hashtag_sets JSONB DEFAULT '{"default": []}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_user ON public.brand_profiles(user_id);

-- ============================================================================
-- CONTENT LIBRARY (all created content)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image', 'video', 'carousel', 'reel', 'story')),
  title TEXT,
  body TEXT,
  media_urls TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  hashtags TEXT[] DEFAULT '{}',
  mentions TEXT[] DEFAULT '{}',
  generated_by TEXT CHECK (generated_by IN ('claude', 'manual', 'template', 'repurposed')),
  generation_prompt TEXT,
  tokens_used INT DEFAULT 0,
  platform_variants JSONB DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_items_user ON public.content_items(user_id);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON public.content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_items_created ON public.content_items(created_at DESC);

-- ============================================================================
-- SCHEDULED POSTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  platforms TEXT[] NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'queued', 'posting', 'posted', 'partial', 'failed', 'cancelled')),
  posted_at TIMESTAMPTZ,
  platform_post_ids JSONB DEFAULT '{}',
  platform_errors JSONB DEFAULT '{}',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  custom_content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled ON public.scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_queue ON public.scheduled_posts(status, scheduled_for)
  WHERE status IN ('scheduled', 'queued');

-- ============================================================================
-- AUTOMATION RULES (the core differentiator)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'schedule',
    'content_ready',
    'trend_match',
    'engagement_drop',
    'new_follower_milestone',
    'webhook'
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL CHECK (action_type IN (
    'generate_content',
    'post_content',
    'repurpose',
    'schedule_post',
    'send_notification',
    'webhook'
  )),
  action_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_template BOOLEAN DEFAULT false,
  template_category TEXT,
  last_triggered_at TIMESTAMPTZ,
  next_trigger_at TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON public.automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON public.automation_rules(is_active, next_trigger_at);
CREATE INDEX IF NOT EXISTS idx_automation_rules_template ON public.automation_rules(is_template, template_category);

-- ============================================================================
-- AUTOMATION EXECUTIONS (audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'skipped', 'cancelled')),
  trigger_data JSONB DEFAULT '{}',
  action_result JSONB DEFAULT '{}',
  error_message TEXT,
  tokens_used INT DEFAULT 0,
  duration_ms INT,
  created_content_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  created_post_id UUID REFERENCES public.scheduled_posts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule ON public.automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_user ON public.automation_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON public.automation_executions(status, triggered_at DESC);

-- ============================================================================
-- ANALYTICS SNAPSHOTS (daily platform metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  connection_id UUID REFERENCES public.platform_connections(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  followers INT DEFAULT 0,
  following INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  saves INT DEFAULT 0,
  profile_views INT DEFAULT 0,
  link_clicks INT DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_date ON public.analytics_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_platform ON public.analytics_snapshots(platform, snapshot_date DESC);

-- ============================================================================
-- POST ANALYTICS (per-post performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_post_id UUID REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_post_id TEXT,
  impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  saves INT DEFAULT 0,
  clicks INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_post ON public.post_analytics(scheduled_post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_user ON public.post_analytics(user_id);

-- ============================================================================
-- USER PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  persona TEXT DEFAULT 'creator' CHECK (persona IN ('agency', 'creator', 'business')),
  timezone TEXT DEFAULT 'America/New_York',
  default_platforms TEXT[] DEFAULT '{}',
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  auto_hashtags BOOLEAN DEFAULT true,
  optimal_time_posting BOOLEAN DEFAULT true,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INT DEFAULT 0,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Platform Connections
CREATE POLICY "Users can view own connections" ON public.platform_connections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own connections" ON public.platform_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own connections" ON public.platform_connections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own connections" ON public.platform_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Brand Profiles
CREATE POLICY "Users can view own brands" ON public.brand_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brands" ON public.brand_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brands" ON public.brand_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brands" ON public.brand_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Content Items
CREATE POLICY "Users can view own content" ON public.content_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content" ON public.content_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content" ON public.content_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content" ON public.content_items
  FOR DELETE USING (auth.uid() = user_id);

-- Scheduled Posts
CREATE POLICY "Users can view own posts" ON public.scheduled_posts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own posts" ON public.scheduled_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.scheduled_posts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.scheduled_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Automation Rules
CREATE POLICY "Users can view own rules and templates" ON public.automation_rules
  FOR SELECT USING (auth.uid() = user_id OR is_template = true);
CREATE POLICY "Users can insert own rules" ON public.automation_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rules" ON public.automation_rules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rules" ON public.automation_rules
  FOR DELETE USING (auth.uid() = user_id);

-- Automation Executions
CREATE POLICY "Users can view own executions" ON public.automation_executions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert executions" ON public.automation_executions
  FOR INSERT WITH CHECK (true);

-- Analytics Snapshots
CREATE POLICY "Users can view own analytics" ON public.analytics_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert analytics" ON public.analytics_snapshots
  FOR INSERT WITH CHECK (true);

-- Post Analytics
CREATE POLICY "Users can view own post analytics" ON public.post_analytics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage post analytics" ON public.post_analytics
  FOR ALL USING (true);

-- User Preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER: Create user preferences on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_preferences();

-- ============================================================================
-- SEED: Automation Rule Templates
-- ============================================================================
INSERT INTO public.automation_rules (
  id,
  user_id,
  name,
  description,
  trigger_type,
  trigger_config,
  action_type,
  action_config,
  is_active,
  is_template,
  template_category
) VALUES
(
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'Daily Optimal Post',
  'Automatically post your best content at the optimal time each day',
  'schedule',
  '{"cron": "0 9 * * *", "timezone": "America/New_York", "description": "Every day at 9 AM"}',
  'post_content',
  '{"source": "library", "selection": "highest_engagement_potential", "platforms": ["instagram", "linkedin"]}',
  false,
  true,
  'creator'
),
(
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'Weekly Content Batch',
  'Generate a week''s worth of content every Monday morning',
  'schedule',
  '{"cron": "0 8 * * 1", "timezone": "America/New_York", "description": "Every Monday at 8 AM"}',
  'generate_content',
  '{"count": 7, "types": ["text"], "platforms": ["twitter", "linkedin"], "prompt_template": "Create engaging content about {{industry}} trends"}',
  false,
  true,
  'business'
),
(
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'Cross-Platform Repurpose',
  'Automatically adapt successful Instagram posts for other platforms',
  'engagement_drop',
  '{"threshold": 0.8, "platform": "instagram", "lookback_hours": 24}',
  'repurpose',
  '{"source_platform": "instagram", "target_platforms": ["twitter", "linkedin", "facebook"]}',
  false,
  true,
  'agency'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.platform_connections IS 'OAuth tokens and connection status for each social platform';
COMMENT ON TABLE public.brand_profiles IS 'Brand identity and voice settings for content generation';
COMMENT ON TABLE public.content_items IS 'Library of all created content (AI-generated and manual)';
COMMENT ON TABLE public.scheduled_posts IS 'Posts scheduled for future publishing';
COMMENT ON TABLE public.automation_rules IS 'User-defined automation rules (trigger → action)';
COMMENT ON TABLE public.automation_executions IS 'Audit log of automation rule executions';
COMMENT ON TABLE public.analytics_snapshots IS 'Daily snapshots of platform analytics';
COMMENT ON TABLE public.post_analytics IS 'Per-post performance metrics';
COMMENT ON TABLE public.user_preferences IS 'User settings and onboarding state';
