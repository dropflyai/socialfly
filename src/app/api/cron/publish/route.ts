import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { publishToMultiplePlatforms } from '@/lib/platforms'

// POST /api/cron/publish — processes scheduled posts that are due
// Called by Vercel Cron or external scheduler every minute
export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get posts that are scheduled and due
  const now = new Date().toISOString()
  const { data: duePosts, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(10) // Process in batches

  if (error) {
    console.error('Cron: failed to fetch due posts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!duePosts?.length) {
    return NextResponse.json({ message: 'No posts due', processed: 0 })
  }

  const results = []

  for (const post of duePosts) {
    // Mark as queued to prevent double-processing
    await supabase
      .from('scheduled_posts')
      .update({ status: 'posting', updated_at: new Date().toISOString() })
      .eq('id', post.id)
      .eq('status', 'scheduled') // Only if still scheduled (optimistic lock)

    try {
      const content = post.custom_content || {}
      const text = content.text || ''
      const mediaUrls = content.media_urls || []
      const mediaType = content.media_type
      // Per-platform variants produced by the automation LLM. Each platform
      // gets its own length/tone/hashtag-optimized copy instead of the same
      // text for all. Falls back to `text` when no variant for a platform.
      const variants = content.variants as Record<string, { text?: string; hashtags?: string[] }> | undefined

      if (!text) {
        // Try loading from content_items if linked
        if (post.content_id) {
          const { data: contentItem } = await supabase
            .from('content_items')
            .select('body, media_urls')
            .eq('id', post.content_id)
            .single()

          if (contentItem) {
            const publishResults = await publishToMultiplePlatforms(
              post.user_id,
              contentItem.body || '',
              post.platforms,
              contentItem.media_urls || [],
              mediaType
            )
            await updatePostStatus(supabase, post.id, publishResults)
            results.push({ postId: post.id, results: publishResults })
            continue
          }
        }

        await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            platform_errors: { _: 'No content text found' },
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id)

        results.push({ postId: post.id, error: 'No content' })
        continue
      }

      const publishResults = await publishToMultiplePlatforms(
        post.user_id,
        text,
        post.platforms,
        mediaUrls.length ? mediaUrls : undefined,
        mediaType,
        variants,
      )

      await updatePostStatus(supabase, post.id, publishResults)
      results.push({ postId: post.id, results: publishResults })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Cron: failed to publish post ${post.id}:`, message)

      // Increment retry count or mark as failed
      const retryCount = (post.retry_count || 0) + 1
      await supabase
        .from('scheduled_posts')
        .update({
          status: retryCount >= (post.max_retries || 3) ? 'failed' : 'scheduled',
          retry_count: retryCount,
          platform_errors: { _: message },
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)

      results.push({ postId: post.id, error: message, retry: retryCount })
    }
  }

  return NextResponse.json({
    message: `Processed ${results.length} posts`,
    processed: results.length,
    results,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updatePostStatus(
  supabase: SupabaseClient<any>,
  postId: string,
  publishResults: { platform: string; success: boolean; platformPostId?: string; error?: string }[]
) {
  const allSuccess = publishResults.every((r) => r.success)
  const someSuccess = publishResults.some((r) => r.success)

  const platformPostIds: Record<string, string> = {}
  const platformErrors: Record<string, string> = {}

  for (const r of publishResults) {
    if (r.success && r.platformPostId) {
      platformPostIds[r.platform] = r.platformPostId
    }
    if (!r.success && r.error) {
      platformErrors[r.platform] = r.error
    }
  }

  await supabase
    .from('scheduled_posts')
    .update({
      status: allSuccess ? 'posted' : someSuccess ? 'partial' : 'failed',
      posted_at: new Date().toISOString(),
      platform_post_ids: platformPostIds,
      platform_errors: platformErrors,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
}

// Also support GET for Vercel Cron (which sends GET requests)
export async function GET(request: NextRequest) {
  return POST(request)
}
