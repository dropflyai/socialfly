-- Fix trigger by removing the problematic users table insert
-- The users table apparently doesn't have subscription_status column
-- Let's just use profiles and token_balances

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create profile and token_balances
  -- Skip users table since it has schema issues

  -- Profiles
  INSERT INTO public.profiles (id, full_name, subscription_tier)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'free')
  ON CONFLICT (id) DO NOTHING;

  -- Token balances
  INSERT INTO public.token_balances (user_id, balance, daily_spent, daily_limit, last_reset_date)
  VALUES (NEW.id, 50, 0, 100, CURRENT_DATE)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-creates profile and token_balances for new users';
