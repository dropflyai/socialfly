/**
 * Publishing Engine
 *
 * Handles publishing and scheduling across platforms.
 * No HTTP dependencies - works standalone.
 */

import { getSupabase } from './config'
import { publishToMultiplePlatforms } from '../platforms'
import type {
  PublishOptions,
  ScheduleOptions,
  FullPublishResult,
  PostRecord,
} from './types'

/**
 * Publish content immediately to one or more platforms.
 */
export async function publish(options: PublishOptions): Promise<FullPublishResult> {
  const { text, platforms, mediaUrls, mediaType, userId, contentId } = options

  const results = await publishToMultiplePlatforms(
    userId,
    text,
    platforms,
    mediaUrls,
    mediaType
  )

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

  // Record the post
  const supabase = getSupabase()
  await supabase.from('scheduled_posts').insert({
    user_id: userId,
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

  return {
    success: allSuccess,
    results,
    contentId,
  }
}

/**
 * Schedule content for future publishing.
 */
export async function schedule(options: ScheduleOptions): Promise<PostRecord> {
  const { text, platforms, mediaUrls, mediaType, userId, contentId, scheduledFor } = options

  const scheduledTime = new Date(scheduledFor)
  if (scheduledTime <= new Date()) {
    throw new Error('Schedule time must be in the future')
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('scheduled_posts')
    .insert({
      user_id: userId,
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

  if (error) throw new Error(`Failed to schedule post: ${error.message}`)

  return mapPostRecord(data)
}

/**
 * List scheduled posts for a user.
 */
export async function listScheduled(
  userId: string,
  options?: { limit?: number; status?: string }
): Promise<PostRecord[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', options?.status || 'scheduled')
    .order('scheduled_for', { ascending: true })
    .limit(options?.limit || 50)

  if (error) throw new Error(`Failed to list scheduled posts: ${error.message}`)
  return (data || []).map(mapPostRecord)
}

/**
 * Cancel a scheduled post.
 */
export async function cancelScheduled(
  userId: string,
  postId: string
): Promise<boolean> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('scheduled_posts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', userId)
    .in('status', ['scheduled', 'draft'])

  if (error) throw new Error(`Failed to cancel post: ${error.message}`)
  return true
}

/**
 * Get post history for a user.
 */
export async function getPostHistory(
  userId: string,
  options?: { status?: string | string[]; platform?: string; limit?: number; since?: string }
): Promise<PostRecord[]> {
  const supabase = getSupabase()
  let query = supabase
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50)

  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.in('status', options.status)
    } else {
      query = query.eq('status', options.status)
    }
  }

  if (options?.platform) {
    query = query.contains('platforms', [options.platform])
  }

  if (options?.since) {
    query = query.gte('created_at', options.since)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to get post history: ${error.message}`)
  return (data || []).map(mapPostRecord)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPostRecord(row: any): PostRecord {
  return {
    id: row.id,
    platforms: row.platforms,
    status: row.status,
    scheduledFor: row.scheduled_for,
    postedAt: row.posted_at || undefined,
    content: {
      text: row.custom_content?.text || '',
      mediaUrls: row.custom_content?.media_urls || [],
      mediaType: row.custom_content?.media_type || undefined,
    },
    platformPostIds: row.platform_post_ids || {},
    platformErrors: row.platform_errors || {},
    createdAt: row.created_at,
  }
}
