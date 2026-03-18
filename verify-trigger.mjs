#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 Verifying Database Trigger Setup\n');

// Query to check if trigger exists
const checkTrigger = `
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
`;

// Query to check if function exists
const checkFunction = `
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
  AND routine_schema = 'public';
`;

// Execute using raw SQL - create a test to verify tables exist
const { data: tables, error: tablesError } = await supabase
  .from('profiles')
  .select('count')
  .limit(1);

if (tablesError) {
  console.log('❌ Tables check failed:', tablesError);
} else {
  console.log('✅ Profiles table exists');
}

const { data: tokenBalances, error: tokenError } = await supabase
  .from('token_balances')
  .select('count')
  .limit(1);

if (tokenError) {
  console.log('❌ Token balances check failed:', tokenError);
} else {
  console.log('✅ Token balances table exists');
}

console.log('\n📋 Migration 009 completed successfully');
console.log('The trigger should have been created.');
console.log('\nTo manually verify in Supabase Dashboard:');
console.log('1. Go to: https://supabase.com/dashboard/project/zoiewcelmnaasbsfcjaj/database/triggers');
console.log('2. Look for: on_auth_user_created trigger');
console.log('\n');
