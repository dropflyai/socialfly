import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/video/status?requestId=xxx&provider=kling — poll for async video generation result
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('requestId')
  const provider = searchParams.get('provider') || 'kling'

  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
  }

  const modelIds: Record<string, string> = {
    kling: 'fal-ai/kling-video',
    seedance: 'fal-ai/seedance-video-01-lora',
  }

  const modelId = modelIds[provider] || modelIds.kling

  try {
    // Check status via Fal API
    const statusRes = await fetch(
      `https://queue.fal.run/${modelId}/requests/${requestId}/status`,
      { headers: { Authorization: `Key ${process.env.FAL_KEY}` } }
    )

    if (!statusRes.ok) {
      return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
    }

    const status = await statusRes.json()

    if (status.status === 'COMPLETED') {
      // Fetch the result
      const resultRes = await fetch(
        `https://queue.fal.run/${modelId}/requests/${requestId}`,
        { headers: { Authorization: `Key ${process.env.FAL_KEY}` } }
      )

      if (!resultRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch result' }, { status: 500 })
      }

      const result = await resultRes.json()

      // Extract video URL from various response shapes
      let videoUrl: string | undefined
      if (result.video?.url) videoUrl = result.video.url
      else if (result.url) videoUrl = result.url
      else if (result.videos?.[0]?.url) videoUrl = result.videos[0].url
      else if (result.output?.url) videoUrl = result.output.url

      return NextResponse.json({
        status: 'completed',
        videoUrl,
        metrics: status.metrics,
      })
    }

    if (status.status === 'FAILED') {
      return NextResponse.json({
        status: 'failed',
        error: 'Video generation failed',
      })
    }

    // Still processing
    return NextResponse.json({
      status: 'processing',
      queuePosition: status.queue_position,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
