-- Fix Authentication Triggers for Auto-Profile Creation
-- This migration ensures profiles and token_balances are created when users sign up

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile entry
  INSERT INTO public.profiles (id, full_name, subscription_tier, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create users entry (for subscription tracking)
  INSERT INTO public.users (id, subscription_tier, subscription_status, created_at, updated_at)
  VALUES (
    NEW.id,
    'free',
    'inactive',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create token_balances entry with initial free tokens
  INSERT INTO public.token_balances (
    user_id,
    balance,
    daily_spent,
    daily_limit,
    last_reset_date,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    50, -- Give 50 free tokens to new users
    0,
    100, -- Free tier daily limit
    CURRENT_DATE,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to execute the function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Ensure RLS policies allow inserts from the trigger
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;

-- Add policies for trigger to insert data
DROP POLICY IF EXISTS "Enable insert for trigger" ON public.profiles;
CREATE POLICY "Enable insert for trigger" ON public.profiles
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable insert for trigger" ON public.users;
CREATE POLICY "Enable insert for trigger" ON public.users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable insert for trigger" ON public.token_balances;
CREATE POLICY "Enable insert for trigger" ON public.token_balances
  FOR INSERT WITH CHECK (true);

-- Also ensure existing policies work
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Add comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile, users, and token_balances entries when a new user signs up';
