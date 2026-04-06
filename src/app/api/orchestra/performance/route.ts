import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getProviderPerformanceReport, getSpendReport } from '@/lib/engine/orchestra'

/**
 * GET /api/orchestra/performance
 *
 * Returns provider performance metrics and spend reports.
 *
 * Query params:
 * - days: number (default 30) — how far back to look
 * - contentType: string — filter by content type (text, image, video, audio)
 * - report: 'performance' | 'spend' | 'both' (default 'both')
 * - spendPeriod: 'day' | 'week' | 'month' (default 'month')
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get('days') || '30', 10)
  const contentType = searchParams.get('contentType') || undefined
  const report = searchParams.get('report') || 'both'
  const spendPeriod = (searchParams.get('spendPeriod') || 'month') as 'day' | 'week' | 'month'

  try {
    const response: Record<string, unknown> = {}

    if (report === 'performance' || report === 'both') {
      response.performance = await getProviderPerformanceReport({ days, contentType })
    }

    if (report === 'spend' || report === 'both') {
      response.spend = await getSpendReport(spendPeriod)
    }

    return NextResponse.json({
      success: true,
      ...response,
    })
  } catch (error) {
    console.error('[Orchestra Performance API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}
