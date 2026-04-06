import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { deductCredits } from '@/lib/credits'
import { orchestrateContent } from '@/lib/engine/orchestra'
import type { OrchestraRequest, Platform, OrchestraContentType, OrchestraBudget, OrchestraUrgency, AudioStyle } from '@/lib/engine/types'

// Allow long-running orchestrations (up to 5 minutes)
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateCheck = checkRateLimit(`${user.id}:orchestra`, RATE_LIMITS.aiGenerate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before orchestrating more content.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  const body = await request.json()
  const {
    brief,
    brandId,
    platforms,
    contentTypes,
    style,
    urgency,
    budget,
    abTest,
    imageAspectRatio,
    audioStyle,
    videoFromImage,
  } = body as Partial<OrchestraRequest>

  // Validate required fields
  if (!brief || !brandId || !platforms?.length || !contentTypes?.length) {
    return NextResponse.json(
      { error: 'Missing required fields: brief, brandId, platforms, contentTypes' },
      { status: 400 }
    )
  }

  // Validate enum values
  const validPlatforms: Platform[] = ['instagram', 'twitter', 'tiktok', 'facebook', 'linkedin']
  const validContentTypes: OrchestraContentType[] = ['text', 'image', 'video', 'audio']

  if (!platforms.every((p: string) => validPlatforms.includes(p as Platform))) {
    return NextResponse.json(
      { error: `Invalid platform. Allowed: ${validPlatforms.join(', ')}` },
      { status: 400 }
    )
  }

  if (!contentTypes.every((ct: string) => validContentTypes.includes(ct as OrchestraContentType))) {
    return NextResponse.json(
      { error: `Invalid content type. Allowed: ${validContentTypes.join(', ')}` },
      { status: 400 }
    )
  }

  // Deduct credits based on content types requested
  // Text = 1 caption credit, Image = 1 image credit, Video = 1 video credit
  const creditActions: { action: string; label: string }[] = []
  if (contentTypes.includes('text')) creditActions.push({ action: 'caption', label: 'text' })
  if (contentTypes.includes('image')) creditActions.push({ action: 'image', label: 'image' })
  if (contentTypes.includes('video')) creditActions.push({ action: 'video_quality', label: 'video' })
  if (contentTypes.includes('audio')) creditActions.push({ action: 'caption', label: 'audio' })

  for (const { action, label } of creditActions) {
    const creditResult = await deductCredits(user.id, action as Parameters<typeof deductCredits>[1])
    if (!creditResult.success) {
      return NextResponse.json(
        { error: `Insufficient credits for ${label}. Please upgrade your plan.`, creditsRemaining: creditResult.creditsRemaining },
        { status: 402 }
      )
    }
  }

  try {
    const result = await orchestrateContent({
      brief,
      brandId,
      platforms: platforms as Platform[],
      contentTypes: contentTypes as OrchestraContentType[],
      style,
      urgency: urgency as OrchestraUrgency | undefined,
      budget: budget as OrchestraBudget | undefined,
      abTest,
      userId: user.id,
      imageAspectRatio: imageAspectRatio as OrchestraRequest['imageAspectRatio'],
      audioStyle: audioStyle as AudioStyle | undefined,
      videoFromImage,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[Orchestra API] Orchestration error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Content orchestration failed' },
      { status: 500 }
    )
  }
}
