import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// POST /api/image/edit — edit an image with natural language
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateCheck = checkRateLimit(`${user.id}:image-edit`, RATE_LIMITS.imageGenerate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before editing more images.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { imageUrl, editPrompt } = await request.json()

  if (!imageUrl || !editPrompt) {
    return NextResponse.json({ error: 'Image URL and edit prompt are required' }, { status: 400 })
  }

  try {
    // Dynamic import to avoid loading the engine at module level
    const { smartEditImage } = await import('@/lib/engine/image-router')
    const result = await smartEditImage(imageUrl, editPrompt)

    return NextResponse.json({
      success: true,
      imageUrl: result.url,
      provider: result.provider,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image editing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
