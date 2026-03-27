/**
 * Engagement Sync — pulls metrics from platform APIs for posted content
 * and stores them in the scheduled_posts.metrics column.
 *
 * Called by the /api/cron/engagement route on a schedule.
 */

import { createClient } from '@supabase/supabase-js'
import { getInstagramMediaInsights } from '@/lib/platforms/instagram'
import { getFacebookPostInsights } from '@/lib/platforms/facebook'

type Platform = 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'linkedin'

interface PlatformConnection {
  id: string
  platform: Platform
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  profile_id: string
  status: string
}

interface PostRow {
  id: string
  user_id: string
  platforms: Platform[]
  platform_post_ids: Record<string, string>
  metrics: Record<string, Record<string, number>> | null
  posted_at: string
}

interface SyncResult {
  postsProcessed: number
  metricsUpdated: number
  errors: string[]
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Sync engagement metrics for recently posted content.
 * Fetches metrics for posts from the last N days that have platform_post_ids.
 */
export async function syncEngagementMetrics(days: number = 7): Promise<SyncResult> {
  const supabase = getSupabase()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Get all posted posts with platform_post_ids from the last N days
  const { data: posts, error: postsError } = await supabase
    .from('scheduled_posts')
    .select('id, user_id, platforms, platform_post_ids, metrics, posted_at')
    .eq('status', 'posted')
    .gte('posted_at', since)
    .not('platform_post_ids', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(100)

  if (postsError) {
    return { postsProcessed: 0, metricsUpdated: 0, errors: [postsError.message] }
  }

  if (!posts?.length) {
    return { postsProcessed: 0, metricsUpdated: 0, errors: [] }
  }

  // Get unique user IDs to batch-fetch their platform connections
  const userIds = [...new Set(posts.map((p: PostRow) => p.user_id))]

  const { data: connections } = await supabase
    .from('platform_connections')
    .select('*')
    .in('user_id', userIds)
    .eq('status', 'active')

  // Index connections by user_id + platform
  const connectionMap = new Map<string, PlatformConnection>()
  for (const conn of (connections || []) as PlatformConnection[]) {
    connectionMap.set(`${conn.user_id}:${conn.platform}`, conn)
  }

  const result: SyncResult = { postsProcessed: 0, metricsUpdated: 0, errors: [] }

  for (const post of (posts as PostRow[])) {
    const platformPostIds = post.platform_post_ids || {}
    const currentMetrics = post.metrics || {}
    let updated = false

    for (const [platform, postId] of Object.entries(platformPostIds)) {
      if (!postId) continue

      const conn = connectionMap.get(`${post.user_id}:${platform}`)
      if (!conn) continue

      try {
        const metrics = await fetchPlatformMetrics(
          platform as Platform,
          conn.access_token,
          postId,
          conn.profile_id
        )

        if (metrics) {
          currentMetrics[platform] = metrics
          updated = true
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        result.errors.push(`Post ${post.id} / ${platform}: ${msg}`)
      }
    }

    if (updated) {
      await supabase
        .from('scheduled_posts')
        .update({ metrics: currentMetrics, updated_at: new Date().toISOString() })
        .eq('id', post.id)

      result.metricsUpdated++
    }

    result.postsProcessed++
  }

  return result
}

/**
 * Fetch metrics from a specific platform API.
 */
async function fetchPlatformMetrics(
  platform: Platform,
  accessToken: string,
  postId: string,
  profileId: string
): Promise<Record<string, number> | null> {
  switch (platform) {
    case 'instagram': {
      const ig = await getInstagramMediaInsights(accessToken, postId)
      return {
        impressions: ig.impressions,
        reach: ig.reach,
        likes: ig.likes,
        comments: ig.comments,
        shares: ig.shares,
        saves: ig.saves,
        engagements: ig.likes + ig.comments + ig.shares + ig.saves,
      }
    }

    case 'facebook': {
      const fbInsights = await getFacebookPostInsights(accessToken, postId)
      const metrics: Record<string, number> = {}

      for (const insight of fbInsights) {
        const name = (insight as { name: string }).name
        const values = (insight as { values: { value: number | Record<string, number> }[] }).values
        const value = values?.[0]?.value

        if (name === 'post_impressions') metrics.impressions = value as number || 0
        if (name === 'post_engagements') metrics.engagements = value as number || 0
        if (name === 'post_clicks') metrics.clicks = value as number || 0
        if (name === 'post_reactions_by_type_total' && typeof value === 'object') {
          const reactions = value as Record<string, number>
          metrics.likes = Object.values(reactions).reduce((a, b) => a + b, 0)
        }
      }

      return metrics
    }

    case 'twitter': {
      // Twitter API v2 requires elevated access for metrics
      // GET /2/tweets/:id?tweet.fields=public_metrics
      try {
        const res = await fetch(
          `https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const pm = data.data?.public_metrics
        if (!pm) return null
        return {
          impressions: pm.impression_count || 0,
          likes: pm.like_count || 0,
          comments: pm.reply_count || 0,
          shares: pm.retweet_count + (pm.quote_count || 0),
          engagements: (pm.like_count || 0) + (pm.reply_count || 0) + (pm.retweet_count || 0),
        }
      } catch {
        return null
      }
    }

    case 'tiktok': {
      // TikTok Content Posting API — query video info
      // GET /v2/video/query with video IDs
      try {
        const res = await fetch('https://open.tiktokapis.com/v2/video/query/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filters: { video_ids: [postId] },
            fields: ['like_count', 'comment_count', 'share_count', 'view_count'],
          }),
        })
        if (!res.ok) return null
        const data = await res.json()
        const video = data.data?.videos?.[0]
        if (!video) return null
        return {
          impressions: video.view_count || 0,
          likes: video.like_count || 0,
          comments: video.comment_count || 0,
          shares: video.share_count || 0,
          engagements: (video.like_count || 0) + (video.comment_count || 0) + (video.share_count || 0),
        }
      } catch {
        return null
      }
    }

    case 'linkedin': {
      // LinkedIn UGC Stats API
      // Requires r_organization_social or r_member_social
      try {
        const urnId = postId.includes('urn:') ? postId : `urn:li:share:${postId}`
        const res = await fetch(
          `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urnId)}?fields=likes,comments`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        return {
          likes: data.likes?.paging?.total || 0,
          comments: data.comments?.paging?.total || 0,
          engagements: (data.likes?.paging?.total || 0) + (data.comments?.paging?.total || 0),
        }
      } catch {
        return null
      }
    }

    default:
      return null
  }
}
