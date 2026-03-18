#!/usr/bin/env node

/**
 * Direct Video Generation Test
 * Tests the FAL.AI video generation endpoint directly
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3020';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const FAL_API_KEY = process.env.FAL_API_KEY;

console.log('\n🎬 VIDEO GENERATION TEST - Direct API Call\n');
console.log('='.repeat(60));

// Check environment variables
console.log('\n📋 Environment Check:');
console.log('✅ SUPABASE_URL:', SUPABASE_URL ? 'SET' : '❌ MISSING');
console.log('✅ SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'SET' : '❌ MISSING');
console.log('✅ FAL_API_KEY:', FAL_API_KEY ? 'SET' : '❌ MISSING');

if (!FAL_API_KEY) {
  console.error('\n❌ FAL_API_KEY is not set in .env.local');
  process.exit(1);
}

async function testVideoGeneration() {
  try {
    console.log('\n🎯 Step 1: Creating Test User Session');
    console.log('-'.repeat(60));

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Create a test user
    const testEmail = `test-video-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    console.log(`Creating user: ${testEmail}`);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError && !signUpError.message.includes('already registered')) {
      console.error('❌ Signup error:', signUpError);
      throw signUpError;
    }

    console.log('✅ User created/exists');

    // Sign in to get session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error('❌ Login error:', signInError);
      throw signInError;
    }

    const accessToken = signInData.session.access_token;
    const userId = signInData.user.id;

    console.log('✅ User authenticated');
    console.log(`User ID: ${userId}`);
    console.log(`Token: ${accessToken.substring(0, 20)}...`);

    // Add tokens to user's balance
    console.log('\n🎯 Step 2: Adding Tokens to User Balance');
    console.log('-'.repeat(60));

    const { data: profileData, error: profileError } = await supabase
      .from('token_balances')
      .upsert({
        user_id: userId,
        balance: 500, // Give 500 tokens for testing
        daily_spent: 0,
        daily_limit: 1000,
        last_reset_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Error adding tokens:', profileError);
    } else {
      console.log('✅ Token balance set to:', profileData.balance);
    }

    // Test video generation
    console.log('\n🎯 Step 3: Testing Video Generation API');
    console.log('-'.repeat(60));

    const videoRequest = {
      prompt: 'A professional business person giving a presentation in a modern office, cinematic lighting, 4K quality',
      engine: 'hailuo', // Fastest engine
      duration: 5, // 5 seconds for quick test
      userId: userId
    };

    console.log('Request:', JSON.stringify(videoRequest, null, 2));

    const response = await fetch(`${BASE_URL}/api/video/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(videoRequest)
    });

    console.log('\nResponse Status:', response.status, response.statusText);

    const responseData = await response.json();
    console.log('\nResponse Data:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ VIDEO GENERATION: SUCCESS!');

      if (responseData.videoUrl) {
        console.log('\n📹 Video URL:', responseData.videoUrl);
        console.log('🎬 Video ID:', responseData.videoId || 'N/A');
        console.log('⏱️ Duration:', responseData.duration || 'N/A', 'seconds');
        console.log('🎨 Engine:', responseData.engine || 'N/A');
      }

      if (responseData.tokensUsed) {
        console.log('\n💰 Tokens Used:', responseData.tokensUsed);
        console.log('💳 Remaining Balance:', responseData.remainingBalance);
      }

      // Check token balance after generation
      const { data: balanceAfter } = await supabase
        .from('token_balances')
        .select('balance, daily_spent')
        .eq('user_id', userId)
        .single();

      if (balanceAfter) {
        console.log('\n📊 Token Balance After Generation:');
        console.log('   Balance:', balanceAfter.balance);
        console.log('   Daily Spent:', balanceAfter.daily_spent);
      }

    } else {
      console.log('\n❌ VIDEO GENERATION: FAILED');
      console.log('Error:', responseData.error || responseData.message || 'Unknown error');

      if (responseData.details) {
        console.log('Details:', responseData.details);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎬 VIDEO GENERATION TEST COMPLETED\n');

    return responseData;

  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error);
    throw error;
  }
}

// Run the test
testVideoGeneration()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
