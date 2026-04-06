/**
 * Growth Engine — Core logic for follower tracking, content scoring,
 * hashtag optimization, and growth recommendations.
 *
 * Powers the /api/cron/growth and /api/growth endpoints.
 */

import { createClient } from '@supabase/supabase-js'
import { getInstagramProfile } from '@/lib/platforms/instagram'
import { getLinkedInOrgStats } from '@/lib/platforms/linkedin'
import Anthropic from '@anthropic-ai/sdk'

type Platform = 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'linkedin'

interface PlatformConnection {
  id: string
  platform: Platform
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  profile_id: string
  profile_name: string
  profile_handle: string
  status: string
  metadata?: Record<string, string>
}

interface FollowerSnapshot {
  platform: Platform
  followers: number
  following: number
  posts_count: number
}

interface GrowthMetrics {
  platform: Platform
  currentFollowers: number
  previousFollowers: number
  growthAbsolute: number
  growthPercent: number
  avgDailyGrowth: number
  projectedMonthly: number
  trend: 'up' | 'down' | 'flat'
}

interface ContentScore {
  postId: string
  text: string
  platforms: string[]
  postedAt: string
  score: number
  metrics: {
    likes: number
    comments: number
    shares: number
    impressions: number
    reach: number
    saves: number
  }
  hashtags: string[]
  recycleWorthy: boolean
  reason: string
}

interface HashtagSuggestion {
  hashtag: string
  category: 'niche' | 'trending' | 'brand' | 'community'
  estimatedReach: string
  competitionLevel: 'low' | 'medium' | 'high'
  recommended: boolean
}

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ============================================================================
// FOLLOWER SNAPSHOT — Called daily by /api/cron/growth
// ============================================================================

/**
 * Take a daily snapshot of follower counts for all active platform connections.
 * Stores results in analytics_snapshots table.
 */
export async function takeFollowerSnapshots(): Promise<{
  snapshots: number
  errors: string[]
}> {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  // Get all active connections across all users
  const { data: connections, error: connError } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('status', 'active')

  if (connError || !connections?.length) {
    return { snapshots: 0, errors: connError ? [connError.message] : ['No active connections'] }
  }

  const errors: string[] = []
  let snapshotCount = 0

  for (const conn of connections as PlatformConnection[]) {
    try {
      const snapshot = await fetchFollowerCount(conn)
      if (!snapshot) continue

      // Upsert into analytics_snapshots (unique on user_id, platform, snapshot_date)
      const { error: upsertError } = await supabase
        .from('analytics_snapshots')
        .upsert(
          {
            user_id: conn.user_id,
            platform: conn.platform,
            connection_id: conn.id,
            snapshot_date: today,
            followers: snapshot.followers,
            following: snapshot.following,
            posts_count: snapshot.posts_count,
            raw_data: snapshot,
          },
          { onConflict: 'user_id,platform,snapshot_date' }
        )

      if (upsertError) {
        errors.push(`Snapshot ${conn.platform}/${conn.profile_handle}: ${upsertError.message}`)
      } else {
        snapshotCount++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${conn.platform}/${conn.profile_handle}: ${msg}`)
    }
  }

  return { snapshots: snapshotCount, errors }
}

/**
 * Fetch follower count from a specific platform API.
 */
async function fetchFollowerCount(
  conn: PlatformConnection
): Promise<FollowerSnapshot | null> {
  switch (conn.platform) {
    case 'instagram': {
      try {
        const profile = await getInstagramProfile(conn.access_token, conn.profile_id)
        return {
          platform: 'instagram',
          followers: profile.followers_count || 0,
          following: 0,
          posts_count: 0,
        }
      } catch {
        // Try basic fields if business insights fail
        const res = await fetch(
          `${GRAPH_API_BASE}/${conn.profile_id}?fields=followers_count,follows_count,media_count&access_token=${conn.access_token}`
        )
        if (!res.ok) return null
        const data = await res.json()
        return {
          platform: 'instagram',
          followers: data.followers_count || 0,
          following: data.follows_count || 0,
          posts_count: data.media_count || 0,
        }
      }
    }

    case 'facebook': {
      const res = await fetch(
        `${GRAPH_API_BASE}/${conn.profile_id}?fields=followers_count,fan_count&access_token=${conn.access_token}`
      )
      if (!res.ok) return null
      const data = await res.json()
      return {
        platform: 'facebook',
        followers: data.followers_count || data.fan_count || 0,
        following: 0,
        posts_count: 0,
      }
    }

    case 'linkedin': {
      if (conn.metadata?.organization_id) {
        try {
          const stats = await getLinkedInOrgStats(conn.access_token, conn.metadata.organization_id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const elements = (stats as any)?.elements || []
          const totalFollowers = elements.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, el: any) => sum + (el?.followerCounts?.organicFollowerCount || 0),
            0
          )
          return {
            platform: 'linkedin',
            followers: totalFollowers,
            following: 0,
            posts_count: 0,
          }
        } catch {
          return null
        }
      }
      // Personal LinkedIn — limited API access for followers
      return null
    }

    case 'twitter': {
      try {
        const res = await fetch(
          'https://api.twitter.com/2/users/me?user.fields=public_metrics',
          { headers: { Authorization: `Bearer ${conn.access_token}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        return {
          platform: 'twitter',
          followers: data.data?.public_metrics?.followers_count || 0,
          following: data.data?.public_metrics?.following_count || 0,
          posts_count: data.data?.public_metrics?.tweet_count || 0,
        }
      } catch {
        return null
      }
    }

    case 'tiktok': {
      try {
        const res = await fetch(
          'https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,video_count',
          { headers: { Authorization: `Bearer ${conn.access_token}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const user = data.data?.user
        return {
          platform: 'tiktok',
          followers: user?.follower_count || 0,
          following: user?.following_count || 0,
          posts_count: user?.video_count || 0,
        }
      } catch {
        return null
      }
    }

    default:
      return null
  }
}

// ============================================================================
// GROWTH DASHBOARD — Powers /api/growth
// ============================================================================

/**
 * Get growth metrics for a user across all platforms.
 * Compares today's followers to N days ago.
 */
export async function getGrowthMetrics(
  userId: string,
  days: number = 30
): Promise<GrowthMetrics[]> {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get the most recent snapshot for each platform
  const { data: latestSnapshots } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('user_id', userId)
    .lte('snapshot_date', today)
    .order('snapshot_date', { ascending: false })
    .limit(20)

  // Get the oldest snapshot in the range for comparison
  const { data: oldestSnapshots } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('snapshot_date', pastDate)
    .order('snapshot_date', { ascending: true })
    .limit(20)

  // Group by platform — get latest and oldest for each
  const platformLatest = new Map<string, { followers: number; snapshot_date: string }>()
  const platformOldest = new Map<string, { followers: number; snapshot_date: string }>()

  for (const snap of (latestSnapshots || [])) {
    if (!platformLatest.has(snap.platform)) {
      platformLatest.set(snap.platform, {
        followers: snap.followers,
        snapshot_date: snap.snapshot_date,
      })
    }
  }

  for (const snap of (oldestSnapshots || [])) {
    if (!platformOldest.has(snap.platform)) {
      platformOldest.set(snap.platform, {
        followers: snap.followers,
        snapshot_date: snap.snapshot_date,
      })
    }
  }

  const metrics: GrowthMetrics[] = []

  for (const [platform, latest] of platformLatest) {
    const oldest = platformOldest.get(platform)
    const previousFollowers = oldest?.followers || latest.followers
    const growthAbsolute = latest.followers - previousFollowers

    // Calculate actual days between snapshots
    const daysBetween = oldest
      ? Math.max(1, Math.ceil(
          (new Date(latest.snapshot_date).getTime() - new Date(oldest.snapshot_date).getTime()) /
          (1000 * 60 * 60 * 24)
        ))
      : 1

    const avgDailyGrowth = growthAbsolute / daysBetween
    const growthPercent = previousFollowers > 0
      ? (growthAbsolute / previousFollowers) * 100
      : 0

    metrics.push({
      platform: platform as Platform,
      currentFollowers: latest.followers,
      previousFollowers,
      growthAbsolute,
      growthPercent: parseFloat(growthPercent.toFixed(2)),
      avgDailyGrowth: parseFloat(avgDailyGrowth.toFixed(1)),
      projectedMonthly: Math.round(avgDailyGrowth * 30),
      trend: avgDailyGrowth > 0.5 ? 'up' : avgDailyGrowth < -0.5 ? 'down' : 'flat',
    })
  }

  return metrics
}

/**
 * Get follower history for chart rendering.
 */
export async function getFollowerHistory(
  userId: string,
  platform?: Platform,
  days: number = 30
): Promise<{ date: string; platform: string; followers: number }[]> {
  const supabase = getSupabase()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let query = supabase
    .from('analytics_snapshots')
    .select('snapshot_date, platform, followers')
    .eq('user_id', userId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })

  if (platform) {
    query = query.eq('platform', platform)
  }

  const { data } = await query

  return (data || []).map((row) => ({
    date: row.snapshot_date,
    platform: row.platform,
    followers: row.followers,
  }))
}

// ============================================================================
// CONTENT SCORING — Identify top performers and recycle-worthy posts
// ============================================================================

/**
 * Score all posts in a time range and identify recycle-worthy content.
 */
export async function scoreContent(
  userId: string,
  days: number = 30
): Promise<ContentScore[]> {
  const supabase = getSupabase()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'posted')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })
    .limit(100)

  if (!posts?.length) return []

  const scored: ContentScore[] = []

  for (const post of posts) {
    const metrics = post.metrics as Record<string, Record<string, number>> | null
    let totalLikes = 0, totalComments = 0, totalShares = 0
    let totalImpressions = 0, totalReach = 0, totalSaves = 0

    if (metrics) {
      for (const m of Object.values(metrics)) {
        totalLikes += m.likes || 0
        totalComments += m.comments || 0
        totalShares += m.shares || 0
        totalImpressions += m.impressions || 0
        totalReach += m.reach || 0
        totalSaves += m.saves || 0
      }
    }

    // Weighted engagement score (comments and shares are more valuable)
    const engagementScore =
      totalLikes * 1 +
      totalComments * 3 +
      totalShares * 5 +
      totalSaves * 4

    // Normalize by impressions (if available) for fair comparison
    const normalizedScore = totalImpressions > 0
      ? (engagementScore / totalImpressions) * 1000
      : engagementScore

    // Extract hashtags from post text
    const text = post.custom_content?.text || ''
    const hashtags = text.match(/#\w+/g) || []

    // Recycle-worthy if above threshold and old enough (>7 days)
    const daysSincePosted = post.posted_at
      ? (Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60 * 60 * 24)
      : 0
    const recycleWorthy = normalizedScore > 5 && daysSincePosted > 7

    let reason = ''
    if (recycleWorthy) {
      if (totalComments > totalLikes * 0.1) reason = 'High conversation starter — repurpose with a question'
      else if (totalShares > totalLikes * 0.05) reason = 'High share rate — repost with updated hook'
      else if (totalSaves > totalLikes * 0.08) reason = 'High save rate — expand into a carousel'
      else reason = 'Strong overall engagement — recycle to other platforms'
    }

    scored.push({
      postId: post.id,
      text: text.slice(0, 150),
      platforms: post.platforms || [],
      postedAt: post.posted_at || post.created_at,
      score: parseFloat(normalizedScore.toFixed(2)),
      metrics: {
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
        impressions: totalImpressions,
        reach: totalReach,
        saves: totalSaves,
      },
      hashtags,
      recycleWorthy,
      reason,
    })
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  return scored
}

// ============================================================================
// SMART HASHTAG RESEARCH — AI-powered hashtag suggestions
// ============================================================================

/**
 * Generate smart hashtag suggestions for a brand using AI analysis
 * of the brand profile, top-performing content, and niche.
 */
export async function getHashtagSuggestions(
  userId: string,
  brandId?: string,
  topic?: string
): Promise<HashtagSuggestion[]> {
  const supabase = getSupabase()
  const anthropic = getAnthropic()

  // Load brand profile
  let brand = null
  if (brandId) {
    const { data } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('id', brandId)
      .single()
    brand = data
  } else {
    // Get default brand
    const { data } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .limit(1)
      .single()
    brand = data
  }

  // Get top-performing posts and their hashtags
  const scored = await scoreContent(userId, 30)
  const topPosts = scored.slice(0, 10)
  const usedHashtags = topPosts.flatMap(p => p.hashtags)
  const hashtagFreq: Record<string, number> = {}
  for (const tag of usedHashtags) {
    hashtagFreq[tag] = (hashtagFreq[tag] || 0) + 1
  }

  // Top-performing hashtags (used in high-scoring posts)
  const topHashtags = topPosts
    .filter(p => p.score > 3)
    .flatMap(p => p.hashtags)

  const prompt = `You are a social media growth expert. Generate 20 strategic hashtag suggestions.

BRAND: ${brand?.name || 'Unknown'}
INDUSTRY: ${brand?.industry || 'technology'}
TARGET AUDIENCE: ${brand?.target_audience || 'general'}
VOICE: ${brand?.voice_tone || 'professional'}
${topic ? `TOPIC: ${topic}` : ''}

TOP PERFORMING HASHTAGS FROM PAST POSTS:
${Object.entries(hashtagFreq).sort(([,a],[,b]) => b - a).slice(0, 15).map(([tag, count]) => `${tag} (used ${count}x)`).join(', ') || 'None yet'}

HASHTAGS FROM TOP SCORED POSTS:
${[...new Set(topHashtags)].slice(0, 10).join(', ') || 'None yet'}

Return a JSON array of 20 hashtag suggestions. Each object should have:
- "hashtag": the hashtag including # symbol
- "category": one of "niche", "trending", "brand", "community"
- "estimatedReach": rough reach estimate like "10K-50K", "50K-200K", "200K-1M", "1M+"
- "competitionLevel": "low", "medium", or "high"
- "recommended": true/false (true for top 8 picks)

Mix of sizes:
- 5 high-reach/high-competition (500K+ reach)
- 8 medium-reach/medium-competition (50K-500K)
- 7 niche/low-competition (under 50K)

Return ONLY the JSON array, no other text.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as HashtagSuggestion[]
    }
  } catch (err) {
    console.error('Hashtag suggestion error:', err)
  }

  // Fallback — return basic suggestions
  return [
    { hashtag: '#AI', category: 'trending', estimatedReach: '1M+', competitionLevel: 'high', recommended: true },
    { hashtag: '#SocialMediaMarketing', category: 'niche', estimatedReach: '200K-1M', competitionLevel: 'medium', recommended: true },
    { hashtag: '#ContentCreation', category: 'niche', estimatedReach: '200K-1M', competitionLevel: 'medium', recommended: true },
    { hashtag: '#MarketingAutomation', category: 'niche', estimatedReach: '50K-200K', competitionLevel: 'low', recommended: true },
    { hashtag: '#GrowthHacking', category: 'trending', estimatedReach: '200K-1M', competitionLevel: 'medium', recommended: true },
  ]
}

// ============================================================================
// GROWTH RECOMMENDATIONS — AI-powered growth advice
// ============================================================================

/**
 * Generate AI-powered growth recommendations based on actual performance data.
 */
export async function getGrowthRecommendations(
  userId: string
): Promise<{
  summary: string
  recommendations: { title: string; description: string; priority: 'high' | 'medium' | 'low'; impact: string }[]
  nextActions: string[]
}> {
  const anthropic = getAnthropic()

  // Gather all the data
  const [growthMetrics, contentScores, followerHistory] = await Promise.all([
    getGrowthMetrics(userId, 30),
    scoreContent(userId, 30),
    getFollowerHistory(userId, undefined, 30),
  ])

  const topPosts = contentScores.slice(0, 5)
  const worstPosts = contentScores.slice(-5)
  const recycleWorthy = contentScores.filter(c => c.recycleWorthy)

  const prompt = `You are a social media growth strategist analyzing a brand's performance. Give specific, actionable recommendations.

GROWTH METRICS (last 30 days):
${growthMetrics.map(g => `${g.platform}: ${g.currentFollowers} followers (${g.growthAbsolute > 0 ? '+' : ''}${g.growthAbsolute}, ${g.trend} trend, ~${g.avgDailyGrowth}/day)`).join('\n') || 'No follower data yet'}

TOP 5 POSTS (by engagement score):
${topPosts.map((p, i) => `${i + 1}. Score: ${p.score} | ${p.platforms.join(',')} | Likes: ${p.metrics.likes}, Comments: ${p.metrics.comments}, Shares: ${p.metrics.shares} | "${p.text.slice(0, 80)}..."`).join('\n') || 'No posts yet'}

WORST 5 POSTS:
${worstPosts.map((p, i) => `${i + 1}. Score: ${p.score} | ${p.platforms.join(',')} | Likes: ${p.metrics.likes}, Comments: ${p.metrics.comments} | "${p.text.slice(0, 80)}..."`).join('\n') || 'No posts yet'}

RECYCLE-WORTHY POSTS: ${recycleWorthy.length}
FOLLOWER HISTORY DAYS: ${followerHistory.length}

Return JSON with:
{
  "summary": "2-3 sentence overview of current growth status",
  "recommendations": [
    {
      "title": "short title",
      "description": "specific actionable advice (2-3 sentences)",
      "priority": "high/medium/low",
      "impact": "Expected impact, e.g. '+5-10 followers/day'"
    }
  ],
  "nextActions": ["immediate action 1", "immediate action 2", "immediate action 3"]
}

Give 5-7 recommendations. Be specific — reference actual post performance data.
Return ONLY the JSON, no other text.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (err) {
    console.error('Growth recommendations error:', err)
  }

  return {
    summary: 'Insufficient data for analysis. Keep posting consistently and check back in a week.',
    recommendations: [
      {
        title: 'Post consistently',
        description: 'Aim for 1-2 posts per day across platforms. Consistency is the #1 driver of organic growth.',
        priority: 'high',
        impact: '+5-10 followers/day',
      },
      {
        title: 'Engage with your audience',
        description: 'Reply to every comment within 1 hour. This boosts algorithmic visibility and builds community.',
        priority: 'high',
        impact: '+2-5 followers/day',
      },
      {
        title: 'Use strategic hashtags',
        description: 'Mix 5-7 niche hashtags with 3-5 broader ones. Avoid banned or overly competitive hashtags.',
        priority: 'medium',
        impact: '+20-50% post reach',
      },
    ],
    nextActions: [
      'Enable daily posting automation for all 3 platforms',
      'Review and recycle top-performing posts from last month',
      'Update hashtag strategy based on AI suggestions',
    ],
  }
}

// ============================================================================
// BEST POSTING TIMES — Data-driven optimal schedule
// ============================================================================

/**
 * Analyze actual post performance to find the best times to post.
 * Returns optimal slots per platform based on real engagement data.
 */
export async function getBestPostingTimes(
  userId: string,
  days: number = 60
): Promise<Record<Platform, { hour: number; day: string; avgEngagement: number }[]>> {
  const supabase = getSupabase()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select('platforms, posted_at, metrics')
    .eq('user_id', userId)
    .eq('status', 'posted')
    .gte('posted_at', since)
    .not('metrics', 'is', null)

  if (!posts?.length) {
    // Return research-backed defaults
    return {
      instagram: [
        { hour: 9, day: 'Monday', avgEngagement: 0 },
        { hour: 12, day: 'Wednesday', avgEngagement: 0 },
        { hour: 17, day: 'Friday', avgEngagement: 0 },
      ],
      facebook: [
        { hour: 9, day: 'Tuesday', avgEngagement: 0 },
        { hour: 13, day: 'Thursday', avgEngagement: 0 },
      ],
      linkedin: [
        { hour: 8, day: 'Tuesday', avgEngagement: 0 },
        { hour: 10, day: 'Wednesday', avgEngagement: 0 },
      ],
      twitter: [
        { hour: 9, day: 'Monday', avgEngagement: 0 },
        { hour: 12, day: 'Wednesday', avgEngagement: 0 },
      ],
      tiktok: [
        { hour: 19, day: 'Thursday', avgEngagement: 0 },
        { hour: 21, day: 'Saturday', avgEngagement: 0 },
      ],
    }
  }

  const days_of_week = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Build a map of platform → hour+day → engagement scores
  const timeSlots: Record<string, Record<string, { totalEngagement: number; count: number }>> = {}

  for (const post of posts) {
    if (!post.posted_at || !post.metrics) continue
    const dt = new Date(post.posted_at)
    const hour = dt.getUTCHours()
    const day = days_of_week[dt.getUTCDay()]

    for (const platform of (post.platforms || [])) {
      if (!timeSlots[platform]) timeSlots[platform] = {}
      const key = `${hour}:${day}`
      if (!timeSlots[platform][key]) timeSlots[platform][key] = { totalEngagement: 0, count: 0 }

      const metrics = (post.metrics as Record<string, Record<string, number>>)[platform]
      if (metrics) {
        const engagement = (metrics.likes || 0) + (metrics.comments || 0) * 3 + (metrics.shares || 0) * 5
        timeSlots[platform][key].totalEngagement += engagement
        timeSlots[platform][key].count++
      }
    }
  }

  // Convert to sorted best times per platform
  const result: Record<string, { hour: number; day: string; avgEngagement: number }[]> = {}

  for (const [platform, slots] of Object.entries(timeSlots)) {
    const sorted = Object.entries(slots)
      .map(([key, data]) => {
        const [hour, day] = key.split(':')
        return {
          hour: parseInt(hour),
          day,
          avgEngagement: parseFloat((data.totalEngagement / data.count).toFixed(1)),
        }
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 5)

    result[platform] = sorted
  }

  return result as Record<Platform, { hour: number; day: string; avgEngagement: number }[]>
}
