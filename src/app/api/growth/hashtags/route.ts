import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getHashtagSuggestions } from '@/lib/growth-engine'

/**
 * GET /api/growth/hashtags — Smart hashtag suggestions
 *
 * Uses AI to generate strategic hashtag recommendations based on:
 * - Brand profile (industry, audience, voice)
 * - Top-performing past content and their hashtags
 * - Niche analysis
 *
 * Query params:
 * - brandId: UUID (optional, uses default brand if omitted)
 * - topic: string (optional, focus suggestions on a specific topic)
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId') || undefined
  const topic = searchParams.get('topic') || undefined

  try {
    const suggestions = await getHashtagSuggestions(user.id, brandId, topic)

    // Group by category for the UI
    const grouped = {
      trending: suggestions.filter(s => s.category === 'trending'),
      niche: suggestions.filter(s => s.category === 'niche'),
      brand: suggestions.filter(s => s.category === 'brand'),
      community: suggestions.filter(s => s.category === 'community'),
    }

    const recommended = suggestions.filter(s => s.recommended)

    return NextResponse.json({
      total: suggestions.length,
      recommended: recommended.length,
      suggestions,
      grouped,
      recommendedSet: recommended.map(s => s.hashtag).join(' '),
    })
  } catch (error) {
    console.error('Hashtag suggestions error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get suggestions' },
      { status: 500 }
    )
  }
}
