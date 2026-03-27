import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { fal } from '@fal-ai/client'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { deductCredits } from '@/lib/credits'
import { checkFeatureAccess } from '@/lib/tier-gates'

fal.config({ credentials: process.env.FAL_KEY })

// Hobby: max 60s, Pro: max 300s
export const maxDuration = 60

type VideoModel = 'fast' | 'quality'

const MODEL_CONFIG: Record<VideoModel, { id: string; label: string }> = {
  fast: { id: 'fal-ai/ltx-video', label: 'LTX Video (Fast, ~$0.02)' },
  quality: { id: 'fal-ai/minimax-video', label: 'Minimax Video (Quality, ~$0.50)' },
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

  const { prompt, imageUrl, model = 'fast' } = await request.json()

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  const modelKey = (model as VideoModel) in MODEL_CONFIG ? model as VideoModel : 'fast'

  const creditAction = modelKey === 'quality' ? 'video_quality' as const : 'video_fast' as const
  const creditResult = await deductCredits(user.id, creditAction, { model: modelKey })
  if (!creditResult.success) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.', creditsRemaining: creditResult.creditsRemaining },
      { status: 402 }
    )
  }
  const config = MODEL_CONFIG[modelKey]

  try {
    let result

    if (imageUrl) {
      // Image-to-video
      if (modelKey === 'fast') {
        result = await fal.subscribe('fal-ai/ltx-video/image-to-video', {
          input: {
            prompt,
            image_url: imageUrl,
            num_inference_steps: 30,
            guidance_scale: 3,
          },
        })
      } else {
        result = await fal.subscribe('fal-ai/minimax-video/image-to-video', {
          input: {
            prompt,
            image_url: imageUrl,
            prompt_optimizer: true,
          },
        })
      }
    } else {
      // Text-to-video
      if (modelKey === 'fast') {
        result = await fal.subscribe('fal-ai/ltx-video', {
          input: {
            prompt,
            num_inference_steps: 30,
            guidance_scale: 3,
          },
        })
      } else {
        result = await fal.subscribe('fal-ai/minimax-video', {
          input: {
            prompt,
            prompt_optimizer: true,
          },
        })
      }
    }

    // Extract video URL -- different models return different shapes
    const data = result.data as Record<string, unknown>
    let videoUrl: string | undefined

    // minimax: { video: { url } }
    if (data.video && typeof data.video === 'object' && 'url' in (data.video as Record<string, unknown>)) {
      videoUrl = (data.video as { url: string }).url
    }
    // ltx-video: { video: { url } } or top-level url
    if (!videoUrl && data.url && typeof data.url === 'string') {
      videoUrl = data.url
    }

    if (!videoUrl) {
      console.error('Unexpected video response shape:', JSON.stringify(data).slice(0, 500))
      throw new Error('No video URL in response')
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      model: config.label,
    })
  } catch (error) {
    console.error('Video generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 }
    )
  }
}
