import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { composeVideo, checkComposeStatus, type ComposeRequest } from '@/lib/engine/video-composer'

export const maxDuration = 60

// POST /api/video/compose — submit a video composition (merge, captions, etc.)
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { videoUrl, audioUrl, captionText, brandName, ctaText, aspectRatio, captionPosition, captionStyle } = body

  if (!videoUrl) {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
  }

  try {
    const result = await composeVideo({
      videoUrl,
      audioUrl,
      audioVolume: audioUrl ? 100 : undefined,
      videoVolume: audioUrl ? 0 : 100,
      captionText,
      captionPosition: captionPosition || 'bottom',
      captionStyle: captionStyle || 'bold',
      brandName,
      ctaText,
      aspectRatio: aspectRatio || '9:16',
    } as ComposeRequest)

    return NextResponse.json({
      success: true,
      renderId: result.id,
      status: result.status,
      url: result.url,
      statusUrl: `/api/video/compose?renderId=${result.id}`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Composition failed' },
      { status: 500 }
    )
  }
}

// GET /api/video/compose?renderId=xxx — check render status
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const renderId = searchParams.get('renderId')

  if (!renderId) {
    return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })
  }

  try {
    const result = await checkComposeStatus(renderId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
