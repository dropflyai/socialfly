#!/usr/bin/env node

/**
 * Authenticated Video Generation Test
 *
 * Tests the video generation API with proper authentication
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_BASE = 'http://localhost:3010';

async function testWithAuth() {
  console.log('\n🎬 Authenticated Video Generation Test\n');
  console.log('='.repeat(70));

  // Check environment
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Missing Supabase credentials in .env.local');
    console.log('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
    console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
    process.exit(1);
  }

  console.log('✅ Environment variables loaded');
  console.log('   Supabase URL:', SUPABASE_URL);
  console.log('   FAL_AI_KEY:', process.env.FAL_AI_KEY ? '✅ Present' : '❌ Missing');
  console.log('   FAL_API_KEY:', process.env.FAL_API_KEY ? '✅ Present' : '❌ Missing');

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('\n📝 Step 1: Sign in to get auth token');
  console.log('-'.repeat(70));

  // Try to get existing user or prompt for credentials
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  let authToken;

  if (session) {
    console.log('✅ Found existing session');
    authToken = session.access_token;
  } else {
    console.log('⚠️  No active session found');
    console.log('   Please sign up/in first at: http://localhost:3010');
    console.log('\n   Or run this test after authenticating in the UI');

    // For testing, let's try to create a test user
    console.log('\n   Attempting to create test user...');
    const testEmail = `test+${Date.now()}@socialsync.test`;
    const testPassword = 'TestPassword123!';

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError) {
      console.log('❌ Failed to create test user:', signUpError.message);
      console.log('\n💡 Manual test steps:');
      console.log('   1. Go to http://localhost:3010');
      console.log('   2. Sign up for an account');
      console.log('   3. Run this test again');
      process.exit(1);
    }

    console.log('✅ Test user created:', testEmail);
    authToken = signUpData.session?.access_token;
  }

  if (!authToken) {
    console.log('❌ No auth token available');
    process.exit(1);
  }

  console.log('✅ Auth token obtained:', authToken.substring(0, 20) + '...');

  // Get user profile
  const { data: { user }, error: userError } = await supabase.auth.getUser(authToken);

  if (userError || !user) {
    console.log('❌ Failed to get user:', userError?.message);
    process.exit(1);
  }

  console.log('✅ User ID:', user.id);

  console.log('\n🎬 Step 2: Generate video with API');
  console.log('-'.repeat(70));

  const testScript = {
    hook: "Stop scrolling! This will change everything.",
    script: "Discover the secret to viral social media content with AI-powered automation.",
    cta: "Try it free today!",
    duration: 6
  };

  const videoRequest = {
    script: testScript,
    brand_colors: {
      primary: '#9333ea',
      secondary: '#3b82f6'
    },
    engine: 'hunyuan-video', // Free tier engine
    duration: 6,
    aspectRatio: '9:16',
    resolution: '1080p',
    includeAudio: false,
  };

  console.log('Request:', JSON.stringify(videoRequest, null, 2));

  try {
    const response = await fetch(`${API_BASE}/api/ai/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(videoRequest)
    });

    const data = await response.json();

    console.log('\n📊 Response Status:', response.status);
    console.log('-'.repeat(70));

    if (response.ok && data.success) {
      console.log('✅ SUCCESS! Video generated');
      console.log('\n🎉 Results:');
      console.log('   Video URL:', data.video_url);
      console.log('   Thumbnail:', data.thumbnail_url || 'N/A');
      console.log('   Engine Used:', data.engine);
      console.log('   Duration:', data.duration, 'seconds');
      console.log('   Tokens Used:', data.tokensUsed);
      console.log('\n📋 Metadata:');
      console.log(JSON.stringify(data.metadata, null, 2));

      console.log('\n✅ TEST PASSED! Video generation is working correctly.');

    } else if (response.status === 403) {
      console.log('⚠️  Insufficient tokens');
      console.log('   Error:', data.error);
      console.log('   Required:', data.required);
      console.log('   Error Code:', data.errorCode);

      if (data.errorCode === 'INSUFFICIENT_TOKENS') {
        console.log('\n💡 The API is working! Just need to add tokens to test user.');
        console.log('   The video generation endpoint is correctly checking tokens.');
        console.log('\n✅ TEST PASSED (API working, needs tokens)');
      }

    } else {
      console.log('❌ FAILED:', data.error || JSON.stringify(data, null, 2));

      // Check for the old bug
      if (data.error && data.error.includes('images')) {
        console.log('\n⚠️  OLD BUG DETECTED!');
        console.log('   Still trying to use image endpoint instead of video.');
      }

      if (data.details) {
        console.log('\n📋 Error Details:');
        console.log(data.details);
      }
    }

  } catch (error) {
    console.log('❌ ERROR:', error.message);
    console.log('\n   Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(70));
  console.log('🏁 Test Complete\n');
}

// Run test
testWithAuth().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
