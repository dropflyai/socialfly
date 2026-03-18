#!/usr/bin/env node
/**
 * Test creating user without relying on trigger
 * Manually create all required entries
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

console.log('\n👤 Creating Test User Manually\n');
console.log('='.repeat(60));

const testEmail = `manual-test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';

// Step 1: Create auth user
console.log('\n1️⃣  Creating auth user...');
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true // Auto-confirm email
});

if (authError) {
  console.error('❌ Failed to create auth user:', authError);
  process.exit(1);
}

const userId = authData.user.id;
console.log('✅ Auth user created:', userId);

// Step 2: Manually create profile
console.log('\n2️⃣  Creating profile...');
const { error: profileError } = await supabase
  .from('profiles')
  .insert({
    id: userId,
    full_name: 'Manual Test User',
    subscription_tier: 'free'
  });

if (profileError) {
  console.error('❌ Failed to create profile:', profileError);
} else {
  console.log('✅ Profile created');
}

// Step 3: Create users entry
console.log('\n3️⃣  Creating users entry...');
const { error: usersError } = await supabase
  .from('users')
  .insert({
    id: userId,
    subscription_tier: 'free',
    subscription_status: 'inactive'
  });

if (usersError) {
  console.error('❌ Failed to create users entry:', usersError);
} else {
  console.log('✅ Users entry created');
}

// Step 4: Create token balance
console.log('\n4️⃣  Creating token balance...');
const { error: tokenError } = await supabase
  .from('token_balances')
  .insert({
    user_id: userId,
    balance: 100,
    daily_spent: 0,
    daily_limit: 100,
    last_reset_date: new Date().toISOString().split('T')[0]
  });

if (tokenError) {
  console.error('❌ Failed to create token balance:', tokenError);
} else {
  console.log('✅ Token balance created');
}

// Step 5: Test login
console.log('\n5️⃣  Testing login...');
const { data: loginData, error: loginError} = await supabase.auth.signInWithPassword({
  email: testEmail,
  password: testPassword
});

if (loginError) {
  console.error('❌ Login failed:', loginError);
} else {
  console.log('✅ Login successful!');
  console.log('   User ID:', loginData.user.id);
  console.log('   Email:', loginData.user.email);
}

console.log('\n' + '='.repeat(60));
console.log('✅ Manual user creation complete!');
console.log('\nTest credentials:');
console.log('  Email:', testEmail);
console.log('  Password:', testPassword);
console.log('\nThis user has 100 tokens and can be used for testing.\n');
