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

  const body = await request.json()
  const { prompt, imageUrl, negativePrompt, duration, aspectRatio } = body
  const modelRaw = (body.model || 'auto').toLowerCase().trim()

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  // Normalize model name — handle variations from AI chat
  const modelNormalized: VideoModel = modelRaw in MODEL_TO_PROVIDER
    ? modelRaw as VideoModel
    : modelRaw.includes('seedance') ? 'seedance'
    : modelRaw.includes('kling') ? 'kling'
    : modelRaw.includes('ltx') || modelRaw.includes('fast') ? 'fast'
    : modelRaw.includes('minimax') ? 'quality'
    : 'auto'

  // Determine credit action based on model
  const provider = MODEL_TO_PROVIDER[modelNormalized]
  const creditAction = provider === 'ltx'
    ? 'video_fast' as const
    : provider === 'seedance'
      ? 'video_quality' as const
      : 'video_quality' as const

  const creditResult = await deductCredits(user.id, creditAction, { model: modelNormalized })
  if (!creditResult.success) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.', creditsRemaining: creditResult.creditsRemaining },
      { status: 402 }
    )
  }

  try {
    let result

    const genParams = {
      negativePrompt,
      duration: duration ? parseInt(duration) : undefined,
      aspectRatio,
    }

    if (provider === 'auto') {
      result = await smartGenerateVideo({
        prompt,
        imageUrl,
        preferredProvider: 'auto',
        ...genParams,
      })
    } else {
      result = await generateVideoWithProvider(
        provider as 'seedance' | 'kling' | 'minimax' | 'ltx',
        prompt,
        imageUrl,
        genParams,
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

    // Cascade fallback: try the next best model down the quality chain
    const fallbackChain: ('seedance' | 'kling' | 'minimax' | 'ltx')[] = ['seedance', 'kling', 'minimax', 'ltx']
    const startIdx = fallbackChain.indexOf(provider as typeof fallbackChain[number])
    const fallbacks = fallbackChain.slice(startIdx + 1)

    for (const fallbackProvider of fallbacks) {
      try {
        console.log(`Trying fallback: ${fallbackProvider}...`)
        const fallback = await generateVideoWithProvider(fallbackProvider, prompt, imageUrl)
        return NextResponse.json({
          success: true,
          videoUrl: fallback.url,
          model: fallback.model + ` (fallback from ${provider})`,
          provider: fallbackProvider,
          fallbackFrom: provider,
        })
      } catch (fallbackError) {
        console.error(`Fallback ${fallbackProvider} also failed:`, fallbackError)
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed — all models unavailable' },
      { status: 500 }
    )
  }
}
