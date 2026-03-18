#!/usr/bin/env node

/**
 * Test Script: Video Generation Fix Verification
 *
 * Tests the InVideo-style multi-agent video generation pipeline
 * to verify the fix for the broken image endpoint issue.
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE || 'http://localhost:3010';

// Test authentication token - replace with actual token
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

async function testVideoGeneration() {
  console.log('\n🎬 Testing Video Generation Fix\n');
  console.log('='.repeat(60));

  // Test 1: Generate video with free tier engine (Hunyuan)
  console.log('\n📹 Test 1: Free Tier Video Generation (Hunyuan)');
  console.log('-'.repeat(60));

  const testScript = {
    hook: "Stop scrolling! This will change everything.",
    script: "Discover the secret to viral social media content with AI-powered automation.",
    cta: "Try it free today!"
  };

  const testRequest = {
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

  try {
    console.log('📤 Sending request to /api/ai/generate-video...');
    console.log('Engine:', testRequest.engine);
    console.log('Duration:', testRequest.duration, 'seconds');
    console.log('Aspect Ratio:', testRequest.aspectRatio);

    const response = await fetch(`${API_BASE}/api/ai/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, you'd need a real auth token
        // 'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify(testRequest)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ SUCCESS! Video generated');
      console.log('Video URL:', data.video_url);
      console.log('Engine Used:', data.engine);
      console.log('Duration:', data.duration, 'seconds');
      console.log('Tokens Used:', data.tokensUsed);
      console.log('Metadata:', JSON.stringify(data.metadata, null, 2));
    } else {
      console.log('❌ FAILED:', data.error || data);
      console.log('Status:', response.status);

      // Check if it's the old bug (trying to use image endpoint)
      if (data.error && data.error.includes('images')) {
        console.log('\n⚠️  OLD BUG DETECTED: Still trying to use image endpoint!');
        console.log('The fix may not have been applied correctly.');
      }
    }

  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  console.log('\n' + '='.repeat(60));

  // Test 2: Check FAL client directly
  console.log('\n🔧 Test 2: FAL Client Direct Test');
  console.log('-'.repeat(60));

  try {
    const FAL_AI_KEY = process.env.FAL_AI_KEY;

    if (!FAL_AI_KEY) {
      console.log('⚠️  FAL_AI_KEY not found in environment');
      console.log('Skipping direct API test');
      return;
    }

    console.log('✅ FAL_AI_KEY found');
    console.log('Testing direct FAL API call...');

    // Test with correct video endpoint
    const falResponse = await fetch('https://fal.run/fal-ai/hunyuan-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_AI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'A beautiful sunset over the ocean with waves crashing on the beach',
        num_frames: 6 * 24, // 6 seconds at 24fps
        aspect_ratio: '16:9',
      }),
    });

    if (falResponse.ok) {
      console.log('✅ FAL API is working correctly!');
      const falData = await falResponse.json();
      console.log('Response:', JSON.stringify(falData, null, 2));
    } else {
      const errorText = await falResponse.text();
      console.log('❌ FAL API error:', falResponse.status, errorText);
    }

  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Test Complete!\n');
}

// Run the test
testVideoGeneration().catch(console.error);
