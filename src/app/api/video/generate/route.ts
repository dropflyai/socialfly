import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { deductCredits } from '@/lib/credits'
import { checkFeatureAccess } from '@/lib/tier-gates'
import {
  smartGenerateVideo,
  generateVideoWithProvider,
  getAvailableVideoModels,
} from '@/lib/engine/video-router'
import type { VideoProvider } from '@/lib/engine/types'

// Hobby: max 60s, Pro: max 300s
export const maxDuration = 300

type VideoModel = 'fast' | 'quality' | 'seedance' | 'kling' | 'auto'

// Map legacy model names to new provider names
const MODEL_TO_PROVIDER: Record<VideoModel, VideoProvider> = {
  fast: 'ltx',
  quality: 'kling',
  seedance: 'seedance',
  kling: 'kling',
  auto: 'auto',
}

export async function GET() {
  return NextResponse.json({
    models: getAvailableVideoModels(),
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateCheck = checkRateLimit(`${user.id}:video-generate`, RATE_LIMITS.videoGenerate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before generating more videos.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  // Video generation requires Pro or higher
  const featureCheck = await checkFeatureAccess(user.id, 'video_generation')
  if (!featureCheck.allowed) {
    return NextResponse.json(
      { error: featureCheck.reason, upgradeRequired: featureCheck.upgradeRequired },
      { status: 403 }
    )
  }

  const { prompt, imageUrl, model = 'auto' } = await request.json()

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  // Determine credit action based on model
  const provider = MODEL_TO_PROVIDER[model as VideoModel] || 'auto'
  const creditAction = provider === 'ltx'
    ? 'video_fast' as const
    : provider === 'seedance'
      ? 'video_quality' as const
      : 'video_quality' as const

  const creditResult = await deductCredits(user.id, creditAction, { model })
  if (!creditResult.success) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.', creditsRemaining: creditResult.creditsRemaining },
      { status: 402 }
    )
  }

  try {
    let result

    if (provider === 'auto') {
      result = await smartGenerateVideo({
        prompt,
        imageUrl,
        preferredProvider: 'auto',
      })
    } else {
      result = await generateVideoWithProvider(
        provider as 'seedance' | 'kling' | 'minimax' | 'ltx',
        prompt,
        imageUrl,
      )
    }

    return NextResponse.json({
      success: true,
      videoUrl: result.url,
      model: result.model,
      provider: result.provider,
      routingScore: 'routingScore' in result ? result.routingScore : undefined,
    })
  } catch (error) {
    console.error(`Video generation error (provider: ${provider}):`, error)

    // Fallback: if the requested model failed, try LTX (fast/reliable)
    if (provider !== 'ltx') {
      try {
        console.log('Falling back to LTX...')
        const fallback = await generateVideoWithProvider('ltx', prompt, imageUrl)
        return NextResponse.json({
          success: true,
          videoUrl: fallback.url,
          model: fallback.model + ' (fallback)',
          provider: 'ltx',
          fallbackFrom: provider,
        })
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 }
    )
  }
}
