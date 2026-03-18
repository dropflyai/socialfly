import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Video Generation API Endpoint
 * POST /api/video/generate
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with service role for auth validation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { prompt, engine = 'fal-ai/minimax-video' } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt' },
        { status: 400 }
      );
    }

    // Check token balance
    const { data: tokenData, error: tokenError } = await supabase
      .from('token_balances')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Failed to check token balance' },
        { status: 500 }
      );
    }

    if (tokenData.balance < 10) {
      return NextResponse.json(
        { error: 'Insufficient tokens. Need at least 10 tokens.' },
        { status: 402 }
      );
    }

    console.log('Generating video with FAL.AI...');
    console.log('Engine:', engine);
    console.log('Prompt:', prompt);

    // Call FAL.AI API
    const falResponse = await fetch(`https://fal.run/${engine}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
      }),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('FAL.AI error:', errorText);
      return NextResponse.json(
        { error: 'Video generation failed', details: errorText },
        { status: 500 }
      );
    }

    const videoResult = await falResponse.json();

    // Deduct tokens (10 tokens per video)
    const { error: deductError } = await supabase
      .from('token_balances')
      .update({ balance: tokenData.balance - 10 })
      .eq('user_id', user.id);

    if (deductError) {
      console.error('Failed to deduct tokens:', deductError);
    }

    return NextResponse.json({
      success: true,
      video: videoResult,
      tokensUsed: 10,
      remainingBalance: tokenData.balance - 10,
    });

  } catch (error: any) {
    console.error('Video generation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
