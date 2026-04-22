import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { deductCredits } from '@/lib/credits'
import { checkFeatureAccess } from '@/lib/tier-gates'
import {
  generateVideoWithProvider,
  getAvailableVideoModels,
  pickVideoProvider,
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
    // I2V drifts as duration grows — 5s gives noticeably better quality than 10s
    // when a reference image is provided. T2V keeps the 10s default.
    const defaultDuration = imageUrl ? 5 : 10
    const genParams = {
      negativePrompt,
      duration: duration ? parseInt(duration) : defaultDuration,
      aspectRatio,
    }

    // Resolve 'auto' via the smart router so users get the best provider
    // for their prompt (cinematic → Seedance, humans → Kling, drafts → LTX,
    // everything else → Minimax). Previously 'auto' was hardcoded to Minimax.
    const resolvedProvider: 'seedance' | 'kling' | 'minimax' | 'ltx' =
      provider === 'auto'
        ? pickVideoProvider({ prompt, imageUrl })
        : (provider as 'seedance' | 'kling' | 'minimax' | 'ltx')

    // Kling and Seedance are too slow for synchronous HTTP — submit to Fal
    // queue and return a requestId. The frontend polls /api/video/status.
    if (resolvedProvider === 'kling' || resolvedProvider === 'seedance') {
      const { fal } = await import('@fal-ai/client')
      fal.config({ credentials: process.env.FAL_KEY })

      const modelIds: Record<string, { text: string; image: string }> = {
        kling: { text: 'fal-ai/kling-video/v1/standard/text-to-video', image: 'fal-ai/kling-video/v1/standard/image-to-video' },
        seedance: { text: 'fal-ai/seedance-video-01-lora', image: 'fal-ai/seedance-video-01-lora' },
      }
      const modelId = imageUrl ? modelIds[resolvedProvider].image : modelIds[resolvedProvider].text

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: Record<string, any> = { prompt }
      if (genParams.negativePrompt) input.negative_prompt = genParams.negativePrompt
      if (imageUrl) input.image_url = imageUrl
      if (resolvedProvider === 'kling') {
        input.duration = String(genParams.duration)
        input.aspect_ratio = genParams.aspectRatio || '16:9'
      }

      const { request_id } = await fal.queue.submit(modelId, { input })

      const modelLabel = resolvedProvider === 'kling'
        ? 'Kling (Realistic, ~$0.20)'
        : 'Seedance 2.0 (Cinematic, ~$0.80)'
      const autoSuffix = provider === 'auto' ? ' — auto-picked' : ''

      return NextResponse.json({
        success: true,
        async: true,
        requestId: request_id,
        provider: resolvedProvider,
        autoPicked: provider === 'auto',
        model: modelLabel + autoSuffix,
        statusUrl: `/api/video/status?requestId=${request_id}&provider=${resolvedProvider}`,
      })
    }

    // Fast models run synchronously.
    const result = await generateVideoWithProvider(
      resolvedProvider,
      prompt,
      imageUrl,
      genParams,
    )

    return NextResponse.json({
      success: true,
      async: false,
      videoUrl: result.url,
      model: result.model + (provider === 'auto' ? ' — auto-picked' : ''),
      provider: resolvedProvider,
      autoPicked: provider === 'auto',
    })
  } catch (error) {
    console.error(`Video generation error (provider: ${provider}):`, error)

    // Fallback to LTX
    try {
      const fallback = await generateVideoWithProvider('ltx', prompt, imageUrl)
      return NextResponse.json({
        success: true,
        async: false,
        videoUrl: fallback.url,
        model: fallback.model + ' (fallback)',
        provider: 'ltx',
      })
    } catch (fallbackError) {
      console.error('LTX fallback also failed:', fallbackError)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 }
    )
  }
}
