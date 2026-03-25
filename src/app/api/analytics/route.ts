import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

// GET /api/analytics — get analytics data for the user
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30')

  const serviceClient = createServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Get all posted posts in the time range
  const { data: posts } = await serviceClient
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'posted')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })

  // Get all posts by status for overview
  const { data: allPosts } = await serviceClient
    .from('scheduled_posts')
    .select('status, platforms')
    .eq('user_id', user.id)
    .gte('created_at', since)

  // Calculate metrics
  const postedPosts = posts || []
  let totalLikes = 0
  let totalComments = 0
  let totalImpressions = 0
  let totalReach = 0

  const platformBreakdown: Record<string, { posts: number; likes: number; comments: number }> = {}
  const postsByDay: Record<string, number> = {}

  for (const post of postedPosts) {
    // Aggregate metrics from stored post metrics
    const metrics = post.metrics as Record<string, { likes?: number; comments?: number; impressions?: number; reach?: number }> | null
    if (metrics) {
      for (const [platform, m] of Object.entries(metrics)) {
        totalLikes += m.likes || 0
        totalComments += m.comments || 0
        totalImpressions += m.impressions || 0
        totalReach += m.reach || 0

        if (!platformBreakdown[platform]) {
          platformBreakdown[platform] = { posts: 0, likes: 0, comments: 0 }
        }
        platformBreakdown[platform].likes += m.likes || 0
        platformBreakdown[platform].comments += m.comments || 0
      }
    }

    // Count posts per platform
    for (const platform of (post.platforms || [])) {
      if (!platformBreakdown[platform]) {
        platformBreakdown[platform] = { posts: 0, likes: 0, comments: 0 }
      }
      platformBreakdown[platform].posts++
    }

    // Posts by day
    if (post.posted_at) {
      const day = post.posted_at.split('T')[0]
      postsByDay[day] = (postsByDay[day] || 0) + 1
    }
  }

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  for (const post of (allPosts || [])) {
    statusCounts[post.status] = (statusCounts[post.status] || 0) + 1
  }

  // Top performing posts
  const topPosts = postedPosts
    .map(post => {
      const metrics = post.metrics as Record<string, { likes?: number; comments?: number }> | null
      let engagement = 0
      if (metrics) {
        for (const m of Object.values(metrics)) {
          engagement += (m.likes || 0) + (m.comments || 0)
        }
      }
      return {
        id: post.id,
        text: post.custom_content?.text?.slice(0, 100) || '',
        platforms: post.platforms,
        postedAt: post.posted_at,
        engagement,
        metrics: post.metrics,
      }
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10)

  const engagementRate = totalImpressions > 0
    ? ((totalLikes + totalComments) / totalImpressions * 100).toFixed(2)
    : '0'

  return NextResponse.json({
    period: { days, since },
    overview: {
      totalPosts: postedPosts.length,
      totalLikes,
      totalComments,
      totalImpressions,
      totalReach,
      engagementRate: parseFloat(engagementRate),
    },
    platformBreakdown,
    postsByDay,
    statusCounts,
    topPosts,
  })
}
