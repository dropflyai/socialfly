import { NextRequest, NextResponse } from 'next/server'
import { syncEngagementMetrics } from '@/lib/engagement-sync'

// POST /api/cron/engagement — sync engagement metrics from platform APIs
// Called by Vercel Cron every 6 hours
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncEngagementMetrics(7) // Last 7 days of posts

    return NextResponse.json({
      message: `Synced engagement for ${result.postsProcessed} posts`,
      ...result,
    })
  } catch (error) {
    console.error('Engagement sync cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

// Support GET for Vercel Cron (sends GET requests)
export async function GET(request: NextRequest) {
  return POST(request)
}
