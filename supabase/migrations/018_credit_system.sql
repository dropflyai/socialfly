-- Credit usage tracking for SocialFly billing
-- Tracks monthly credit consumption per user with automatic reset on billing cycle

CREATE TABLE IF NOT EXISTS public.credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_used INTEGER DEFAULT 0,
  credits_limit INTEGER DEFAULT 50,
  period_start TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  period_end TIMESTAMPTZ DEFAULT (date_trunc('month', now()) + interval '1 month'),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user ON public.credit_usage(user_id);

ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own credit usage
CREATE POLICY "Users can view own credit usage" ON public.credit_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Service role full access for webhook/API updates
CREATE POLICY "Service role full access credit_usage" ON public.credit_usage
  FOR ALL USING (auth.role() = 'service_role');

-- Credit usage log for auditing individual deductions
CREATE TABLE IF NOT EXISTS public.credit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'caption', 'image_generate', 'image_edit', 'video_fast', 'video_quality'
  credits_deducted INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_log_user ON public.credit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_log_created ON public.credit_log(created_at);

ALTER TABLE public.credit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit log" ON public.credit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access credit_log" ON public.credit_log
  FOR ALL USING (auth.role() = 'service_role');
