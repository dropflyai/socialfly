/**
 * Analytics Engine
 *
 * Aggregates engagement metrics across platforms from post history.
 * Calculates best posting times, engagement rates, and top-performing content.
 */

import { getSupabase } from './config'
import type { Platform, PlatformAnalytics } from './types'

interface PostRow {
  id: string
  platforms: Platform[]
  status: string
  posted_at: string | null
  platform_post_ids: Record<string, string>
  platform_errors: Record<string, string>
  custom_content: { text: string; media_urls: string[]; media_type?: string }
  created_at: string
  metrics?: Record<string, PlatformPostMetrics>
}

interface PlatformPostMetrics {
  impressions?: number
  engagements?: number
  clicks?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  reach?: number
}

/**
 * Get analytics summary for a user across all or specific platforms.
 */
export async function getAnalytics(
  userId: string,
  options?: {
    platforms?: Platform[]
    since?: string
    until?: string
  }
): Promise<PlatformAnalytics[]> {
  const supabase = getSupabase()

  let query = supabase
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })

  if (options?.since) query = query.gte('posted_at', options.since)
  if (options?.until) query = query.lte('posted_at', options.until)

  const { data, error } = await query
  if (error) throw new Error(`Failed to get analytics: ${error.message}`)

  const posts = (data || []) as PostRow[]
  const targetPlatforms = options?.platforms || ['instagram', 'twitter', 'tiktok', 'facebook', 'linkedin'] as Platform[]

  const results: PlatformAnalytics[] = []

  for (const platform of targetPlatforms) {
    const platformPosts = posts.filter(p => p.platforms.includes(platform))
    if (platformPosts.length === 0) continue

    // Aggregate metrics from stored post metrics
    let totalImpressions = 0
    let totalEngagements = 0
    let totalClicks = 0

    const topPosts: { postId: string; text: string; engagements: number }[] = []

    for (const post of platformPosts) {
      const metrics = post.metrics?.[platform]
      if (metrics) {
        totalImpressions += metrics.impressions || 0
        totalEngagements += metrics.engagements || (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0)
        totalClicks += metrics.clicks || 0
      }

      topPosts.push({
        postId: post.id,
        text: (post.custom_content?.text || '').slice(0, 100),
        engagements: metrics?.engagements || (metrics?.likes || 0) + (metrics?.comments || 0) + (metrics?.shares || 0) || 0,
      })
    }

    // Sort by engagements descending
    topPosts.sort((a, b) => b.engagements - a.engagements)

    // Calculate best posting times from successful posts
    const postingHours: Record<number, number> = {}
    for (const post of platformPosts) {
      if (post.posted_at) {
        const hour = new Date(post.posted_at).getUTCHours()
        postingHours[hour] = (postingHours[hour] || 0) + 1
      }
    }

    const sortedHours = Object.entries(postingHours)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => {
        const h = parseInt(hour)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
        return `${displayHour}:00 ${ampm} UTC`
      })

    // Days between first and last post
    const firstPost = platformPosts[platformPosts.length - 1]
    const lastPost = platformPosts[0]
    const daySpan = firstPost?.posted_at && lastPost?.posted_at
      ? Math.max(1, Math.ceil((new Date(lastPost.posted_at).getTime() - new Date(firstPost.posted_at).getTime()) / (1000 * 60 * 60 * 24)))
      : 1

    results.push({
      platform,
      followers: 0, // Would need platform API calls to get live follower count
      impressions: totalImpressions,
      engagements: totalEngagements,
      clicks: totalClicks,
      engagementRate: totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0,
      topPosts: topPosts.slice(0, 5),
      postingFrequency: parseFloat((platformPosts.length / daySpan).toFixed(2)),
      bestPostingTimes: sortedHours.length > 0 ? sortedHours : ['9:00 AM UTC', '12:00 PM UTC', '5:00 PM UTC'],
    })
  }

  return results
}

/**
 * Store metrics for a specific post (called after fetching from platform APIs or webhooks).
 */
export async function storePostMetrics(
  postId: string,
  platform: Platform,
  metrics: PlatformPostMetrics
): Promise<void> {
  const supabase = getSupabase()

  // Get current metrics
  const { data: post } = await supabase
    .from('scheduled_posts')
    .select('metrics')
    .eq('id', postId)
    .single()

  const currentMetrics = (post?.metrics || {}) as Record<string, PlatformPostMetrics>
  currentMetrics[platform] = metrics

  await supabase
    .from('scheduled_posts')
    .update({ metrics: currentMetrics })
    .eq('id', postId)
}

/**
 * Get performance summary — high-level overview across all platforms.
 */
export async function getPerformanceSummary(
  userId: string,
  days: number = 30
): Promise<{
  totalPosts: number
  totalImpressions: number
  totalEngagements: number
  avgEngagementRate: number
  platformBreakdown: Record<string, { posts: number; engagements: number }>
  topPerforming: { postId: string; text: string; platform: string; engagements: number }[]
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const analytics = await getAnalytics(userId, { since })

  let totalPosts = 0
  let totalImpressions = 0
  let totalEngagements = 0
  const platformBreakdown: Record<string, { posts: number; engagements: number }> = {}
  const allTopPosts: { postId: string; text: string; platform: string; engagements: number }[] = []

  for (const pa of analytics) {
    const posts = pa.topPosts.length
    totalPosts += posts
    totalImpressions += pa.impressions
    totalEngagements += pa.engagements
    platformBreakdown[pa.platform] = { posts, engagements: pa.engagements }

    for (const tp of pa.topPosts) {
      allTopPosts.push({ ...tp, platform: pa.platform })
    }
  }

  allTopPosts.sort((a, b) => b.engagements - a.engagements)

  return {
    totalPosts,
    totalImpressions,
    totalEngagements,
    avgEngagementRate: totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0,
    platformBreakdown,
    topPerforming: allTopPosts.slice(0, 10),
  }
}
