import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { publishToMultiplePlatforms } from '@/lib/platforms'
import { checkScheduleLimit } from '@/lib/tier-gates'

interface PublishRequest {
  contentId?: string
  text: string
  platforms: ('twitter' | 'instagram' | 'tiktok')[]
  mediaUrls?: string[]
  mediaType?: 'image' | 'video' | 'carousel'
  scheduleFor?: string // ISO timestamp for scheduled posting
}

// POST /api/posts/publish — publish or schedule a post
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: PublishRequest = await request.json()
  const { text, platforms, mediaUrls, mediaType, scheduleFor, contentId } = body

  if (!text || !platforms?.length) {
    return NextResponse.json({ error: 'Missing text or platforms' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // If scheduling for later, check schedule limit then create record
  if (scheduleFor) {
    const scheduleCheck = await checkScheduleLimit(user.id)
    if (!scheduleCheck.allowed) {
      return NextResponse.json(
        { error: scheduleCheck.reason, upgradeRequired: scheduleCheck.upgradeRequired },
        { status: 403 }
      )
    }
    const scheduledTime = new Date(scheduleFor)
    if (scheduledTime <= new Date()) {
      return NextResponse.json({ error: 'Schedule time must be in the future' }, { status: 400 })
    }

    const { data: post, error: dbError } = await serviceClient
      .from('scheduled_posts')
      .insert({
        user_id: user.id,
        content_id: contentId || null,
        platforms,
        scheduled_for: scheduledTime.toISOString(),
        status: 'scheduled',
        custom_content: {
          text,
          media_urls: mediaUrls || [],
          media_type: mediaType,
        },
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      scheduled: true,
      post,
    })
  }

  // Publish immediately
  try {
    const results = await publishToMultiplePlatforms(
      user.id,
      text,
      platforms,
      mediaUrls,
      mediaType
    )

    // Save the post record
    const allSuccess = results.every((r) => r.success)
    const platformPostIds: Record<string, string> = {}
    const platformErrors: Record<string, string> = {}

    for (const r of results) {
      if (r.success && r.platformPostId) {
        platformPostIds[r.platform] = r.platformPostId
      }
      if (!r.success && r.error) {
        platformErrors[r.platform] = r.error
      }
    }

    await serviceClient.from('scheduled_posts').insert({
      user_id: user.id,
      content_id: contentId || null,
      platforms,
      scheduled_for: new Date().toISOString(),
      status: allSuccess ? 'posted' : results.some((r) => r.success) ? 'partial' : 'failed',
      posted_at: new Date().toISOString(),
      platform_post_ids: platformPostIds,
      platform_errors: platformErrors,
      custom_content: {
        text,
        media_urls: mediaUrls || [],
        media_type: mediaType,
      },
    })

    return NextResponse.json({
      success: allSuccess,
      results,
    })
  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 500 }
    )
  }
}
