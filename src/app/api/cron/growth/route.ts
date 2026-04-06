import { NextRequest, NextResponse } from 'next/server'
import { takeFollowerSnapshots } from '@/lib/growth-engine'

export const maxDuration = 120 // 2 minutes max

/**
 * POST /api/cron/growth — Daily follower snapshot cron
 *
 * Takes a snapshot of follower counts across all platforms for all users.
 * Called once per day by Vercel Cron.
 *
 * Populates the analytics_snapshots table with follower growth data.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await takeFollowerSnapshots()

    return NextResponse.json({
      message: `Growth snapshot complete: ${result.snapshots} snapshots taken`,
      ...result,
    })
  } catch (error) {
    console.error('Growth snapshot cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Snapshot failed' },
      { status: 500 }
    )
  }
}

// Support GET for Vercel Cron (sends GET requests)
export async function GET(request: NextRequest) {
  return POST(request)
}
