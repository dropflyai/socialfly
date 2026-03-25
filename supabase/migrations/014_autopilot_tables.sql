-- Autopilot, Content Calendar, and Brand Kit tables

CREATE TABLE IF NOT EXISTS content_calendars (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  platforms jsonb DEFAULT '[]',
  posts_per_day int DEFAULT 1,
  themes jsonb DEFAULT '[]',
  entries jsonb DEFAULT '[]',
  campaign_id uuid,
  strategy_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS autopilot_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  timestamp timestamptz NOT NULL,
  posts_created int DEFAULT 0,
  posts_scheduled int DEFAULT 0,
  repurposed int DEFAULT 0,
  skipped int DEFAULT 0,
  errors jsonb DEFAULT '[]',
  insights jsonb DEFAULT '[]',
  actions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_kits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid UNIQUE NOT NULL,
  name text NOT NULL,
  logos jsonb DEFAULT '{}',
  colors jsonb DEFAULT '{}',
  fonts jsonb,
  image_style text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add metrics and campaign_id columns to scheduled_posts if missing
DO $$ BEGIN
  ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS metrics jsonb;
  ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS campaign_id uuid;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create exec_sql function for future automated migrations
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  EXECUTE query;
  RETURN json_build_object('success', true, 'message', 'Query executed successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
