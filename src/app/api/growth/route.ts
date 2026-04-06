import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  getGrowthMetrics,
  getFollowerHistory,
  scoreContent,
  getBestPostingTimes,
  getGrowthRecommendations,
} from '@/lib/growth-engine'

/**
 * GET /api/growth — Growth dashboard data
 *
 * Returns comprehensive growth metrics including:
 * - Follower growth per platform
 * - Follower history for charts
 * - Content performance scores
 * - Best posting times
 * - AI-powered growth recommendations
 *
 * Query params:
 * - days: number (default 30)
 * - include: comma-separated list of sections to include
 *   (metrics, history, scores, times, recommendations)
 *   Default: all
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30')
  const includeParam = searchParams.get('include') || 'metrics,history,scores,times,recommendations'
  const sections = includeParam.split(',').map(s => s.trim())

  const response: Record<string, unknown> = { period: { days } }

  try {
    // Run requested sections in parallel
    const promises: Promise<void>[] = []

    if (sections.includes('metrics')) {
      promises.push(
        getGrowthMetrics(user.id, days).then(data => { response.metrics = data })
      )
    }

    if (sections.includes('history')) {
      promises.push(
        getFollowerHistory(user.id, undefined, days).then(data => { response.history = data })
      )
    }

    if (sections.includes('scores')) {
      promises.push(
        scoreContent(user.id, days).then(data => {
          response.scores = {
            total: data.length,
            recycleWorthy: data.filter(s => s.recycleWorthy).length,
            topPosts: data.slice(0, 10),
            recycleReady: data.filter(s => s.recycleWorthy).slice(0, 5),
          }
        })
      )
    }

    if (sections.includes('times')) {
      promises.push(
        getBestPostingTimes(user.id, Math.max(days, 60)).then(data => { response.bestTimes = data })
      )
    }

    if (sections.includes('recommendations')) {
      promises.push(
        getGrowthRecommendations(user.id).then(data => { response.recommendations = data })
      )
    }

    await Promise.all(promises)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Growth API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get growth data' },
      { status: 500 }
    )
  }
}
