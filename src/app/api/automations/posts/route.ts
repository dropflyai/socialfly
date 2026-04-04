import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

// GET /api/automations/posts?ruleId=xxx — get posts created by a specific automation
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ruleId = searchParams.get('ruleId')
  if (!ruleId) return NextResponse.json({ error: 'Missing ruleId' }, { status: 400 })

  const serviceClient = createServiceClient()

  // Get upcoming (scheduled + draft)
  const { data: upcoming } = await serviceClient
    .from('scheduled_posts')
    .select('id, platforms, status, scheduled_for, custom_content, created_at')
    .eq('user_id', user.id)
    .in('status', ['scheduled', 'draft'])
    .filter('custom_content->>automation_rule_id', 'eq', ruleId)
    .order('scheduled_for', { ascending: true })
    .limit(10)

  // Get history (posted, failed, partial)
  const { data: history } = await serviceClient
    .from('scheduled_posts')
    .select('id, platforms, status, posted_at, custom_content, metrics, created_at')
    .eq('user_id', user.id)
    .in('status', ['posted', 'failed', 'partial'])
    .filter('custom_content->>automation_rule_id', 'eq', ruleId)
    .order('posted_at', { ascending: false })
    .limit(20)

  // Calculate stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posted = (history || []).filter((p: any) => p.status === 'posted')
  let totalLikes = 0
  let totalComments = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const post of posted) {
    const metrics = post.metrics as Record<string, { likes?: number; comments?: number }> | null
    if (metrics) {
      for (const m of Object.values(metrics)) {
        totalLikes += m.likes || 0
        totalComments += m.comments || 0
      }
    }
  }

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upcoming: (upcoming || []).map((p: any) => ({
      id: p.id,
      status: p.status,
      platforms: p.platforms,
      scheduledFor: p.scheduled_for,
      text: (p.custom_content as { text?: string })?.text || '',
      mediaUrls: (p.custom_content as { media_urls?: string[] })?.media_urls || [],
      variants: (p.custom_content as { variants?: Record<string, { text: string; hashtags?: string[] }> })?.variants || null,
      createdAt: p.created_at,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history: (history || []).map((p: any) => ({
      id: p.id,
      status: p.status,
      platforms: p.platforms,
      postedAt: p.posted_at,
      text: (p.custom_content as { text?: string })?.text || '',
      mediaUrls: (p.custom_content as { media_urls?: string[] })?.media_urls || [],
      metrics: p.metrics,
      createdAt: p.created_at,
    })),
    stats: {
      totalPosted: posted.length,
      totalLikes,
      totalComments,
      totalEngagement: totalLikes + totalComments,
      pendingCount: (upcoming || []).filter((p: any) => p.status === 'draft').length,
      scheduledCount: (upcoming || []).filter((p: any) => p.status === 'scheduled').length,
    },
  })
}
