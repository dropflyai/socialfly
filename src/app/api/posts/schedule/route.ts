import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { publishToMultiplePlatforms } from '@/lib/platforms'

// GET /api/posts/schedule — list scheduled posts for user
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'scheduled'

  const serviceClient = createServiceClient()
  const { data: posts, error } = await serviceClient
    .from('scheduled_posts')
    .select('*, content_items(*)')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ posts })
}

// PATCH /api/posts/schedule?id=xxx&action=approve — approve a draft post
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('id')
  const action = searchParams.get('action')

  if (!postId) {
    return NextResponse.json({ error: 'Missing post ID' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  if (action === 'approve') {
    // APPROVE-ONCE: a human approved this draft, so publish it NOW via the
    // supervised path. This deliberately does NOT depend on the autonomous
    // publish cron (which is gated by AUTOMATIONS_ENABLED) — human approval IS
    // the authorization. Mirrors the cron's publish + status-update logic.
    const { data: post, error: loadErr } = await serviceClient
      .from('scheduled_posts')
      .select('*, content_items(body, media_urls)')
      .eq('id', postId)
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .single()

    if (loadErr || !post) {
      return NextResponse.json({ error: 'Draft not found or already actioned' }, { status: 404 })
    }

    // Optimistic lock: only proceed if still a draft (prevents double-publish).
    const { data: locked } = await serviceClient
      .from('scheduled_posts')
      .update({ status: 'posting', updated_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('status', 'draft')
      .select('id')
    if (!locked?.length) {
      return NextResponse.json({ error: 'Draft already being processed' }, { status: 409 })
    }

    const content = (post.custom_content || {}) as {
      text?: string; media_urls?: string[]; media_type?: 'video' | 'image' | 'carousel'
      variants?: Record<string, { text?: string; hashtags?: string[] }>
    }
    let text = content.text || ''
    let mediaUrls = content.media_urls || []
    const mediaType = content.media_type
    const variants = content.variants
    const contentItem = post.content_items as { body?: string; media_urls?: string[] } | null
    if (!text && contentItem) {
      text = contentItem.body || ''
      mediaUrls = contentItem.media_urls || mediaUrls
    }

    try {
      const results = await publishToMultiplePlatforms(
        post.user_id,
        text,
        post.platforms,
        mediaUrls.length ? mediaUrls : undefined,
        mediaType,
        variants,
      )
      const allSuccess = results.every((r) => r.success)
      const someSuccess = results.some((r) => r.success)
      const platformPostIds: Record<string, string> = {}
      const platformErrors: Record<string, string> = {}
      for (const r of results) {
        if (r.success && r.platformPostId) platformPostIds[r.platform] = r.platformPostId
        if (!r.success && r.error) platformErrors[r.platform] = r.error
      }
      const finalStatus = allSuccess ? 'posted' : someSuccess ? 'partial' : 'failed'
      await serviceClient
        .from('scheduled_posts')
        .update({
          status: finalStatus,
          posted_at: new Date().toISOString(),
          platform_post_ids: platformPostIds,
          platform_errors: platformErrors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)

      return NextResponse.json({ success: allSuccess, status: finalStatus, results })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed'
      await serviceClient
        .from('scheduled_posts')
        .update({ status: 'failed', platform_errors: { _: msg }, updated_at: new Date().toISOString() })
        .eq('id', postId)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (action === 'edit') {
    // Update the draft text
    const body = await request.json()
    const { text } = body

    // Get current custom_content and merge the new text
    const { data: post } = await serviceClient
      .from('scheduled_posts')
      .select('custom_content')
      .eq('id', postId)
      .eq('user_id', user.id)
      .single()

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const updatedContent = { ...(post.custom_content as Record<string, unknown>), text }

    const { error } = await serviceClient
      .from('scheduled_posts')
      .update({
        custom_content: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// DELETE /api/posts/schedule?id=xxx — cancel a scheduled post
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('id')

  if (!postId) {
    return NextResponse.json({ error: 'Missing post ID' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('scheduled_posts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', user.id)
    .in('status', ['scheduled', 'draft'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
