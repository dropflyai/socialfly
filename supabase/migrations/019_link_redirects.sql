-- Short-link redirect table for tracking clicks from social posts.
-- socialfly.io/go/{slug} redirects to target_url and increments click_count.
-- Gives us per-post click attribution that feeds back into the automation
-- learning loop.

-- Conversion URL on brand profiles — where CTAs should drive traffic.
-- e.g. DreamFly's landing page at https://dreamfly.dropfly.io
ALTER TABLE public.brand_profiles
  ADD COLUMN IF NOT EXISTS conversion_url TEXT;

CREATE TABLE IF NOT EXISTS public.link_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  post_id UUID REFERENCES public.scheduled_posts(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  platform TEXT, -- which platform this link was included on
  click_count INTEGER NOT NULL DEFAULT 0,
  first_clicked_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_redirects_slug ON public.link_redirects(slug);
CREATE INDEX IF NOT EXISTS idx_link_redirects_post ON public.link_redirects(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_redirects_brand_created ON public.link_redirects(brand_id, created_at DESC) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_redirects_user ON public.link_redirects(user_id, created_at DESC);

-- RLS: users can see their own links. Service role bypasses.
ALTER TABLE public.link_redirects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS link_redirects_select_own ON public.link_redirects;
CREATE POLICY link_redirects_select_own ON public.link_redirects
  FOR SELECT USING (user_id = auth.uid());

-- The redirect route uses service_role, so no insert/update policy for users needed.
