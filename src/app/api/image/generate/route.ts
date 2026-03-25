import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { fal } from '@fal-ai/client'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

fal.config({ credentials: process.env.FAL_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateCheck = checkRateLimit(`${user.id}:image-generate`, RATE_LIMITS.imageGenerate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before generating more images.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { prompt, aspectRatio = '1:1' } = await request.json()

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  try {
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt,
        image_size: aspectRatio === '4:5' ? { width: 1080, height: 1350 }
          : aspectRatio === '9:16' ? { width: 1080, height: 1920 }
          : { width: 1080, height: 1080 },
        num_images: 1,
      },
    })

    const images = (result.data as { images?: { url: string }[] }).images
    if (!images?.length) {
      throw new Error('No image generated')
    }

    return NextResponse.json({
      success: true,
      imageUrl: images[0].url,
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    )
  }
}
