import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// GET /api/analytics/insights — AI-generated insights from post performance
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30')

  const serviceClient = createServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Get posted content with metrics
  const { data: posts } = await serviceClient
    .from('scheduled_posts')
    .select('custom_content, platforms, metrics, posted_at, status')
    .eq('user_id', user.id)
    .eq('status', 'posted')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })
    .limit(30)

  if (!posts?.length) {
    return NextResponse.json({
      insights: {
        summary: 'Not enough data yet. Post more content to get AI-powered insights on your performance.',
        tips: ['Connect your social platforms and start posting to see insights here.'],
        topPerforming: null,
        bestTime: null,
        bestPlatform: null,
      },
    })
  }

  // Build a performance summary for Claude to analyze
  interface PostSummary { text: string; platforms: string[]; likes: number; comments: number; shares: number; impressions: number; reach: number; engagement: number; day: string; hour: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postSummaries: PostSummary[] = posts.map((p: any) => {
    const text = (p.custom_content as { text?: string })?.text?.slice(0, 100) || 'No text'
    const metrics = p.metrics as Record<string, { likes?: number; comments?: number; shares?: number; impressions?: number; reach?: number }> | null
    let likes = 0, comments = 0, shares = 0, impressions = 0, reach = 0
    if (metrics) {
      for (const m of Object.values(metrics)) {
        likes += m.likes || 0
        comments += m.comments || 0
        shares += m.shares || 0
        impressions += m.impressions || 0
        reach += m.reach || 0
      }
    }
    const day = p.posted_at ? new Date(p.posted_at).toLocaleDateString('en-US', { weekday: 'short' }) : 'unknown'
    const hour = p.posted_at ? new Date(p.posted_at).getHours() : 0
    return {
      text,
      platforms: p.platforms,
      likes, comments, shares, impressions, reach,
      engagement: likes + comments + shares,
      day, hour,
    }
  })

  const totalPosts = postSummaries.length
  const totalEngagement = postSummaries.reduce((sum: number, p) => sum + p.engagement, 0)
  const avgEngagement = Math.round(totalEngagement / totalPosts)
  const topPost = [...postSummaries].sort((a, b) => b.engagement - a.engagement)[0]
  const bottomPost = [...postSummaries].sort((a, b) => a.engagement - b.engagement)[0]

  // Platform breakdown
  const platformStats: Record<string, { posts: number; engagement: number }> = {}
  for (const p of postSummaries) {
    for (const plat of p.platforms) {
      if (!platformStats[plat]) platformStats[plat] = { posts: 0, engagement: 0 }
      platformStats[plat].posts++
      platformStats[plat].engagement += p.engagement
    }
  }

  // Best posting time
  const hourBuckets: Record<number, { count: number; engagement: number }> = {}
  for (const p of postSummaries) {
    if (!hourBuckets[p.hour]) hourBuckets[p.hour] = { count: 0, engagement: 0 }
    hourBuckets[p.hour].count++
    hourBuckets[p.hour].engagement += p.engagement
  }

  const dataForClaude = `
SOCIAL MEDIA PERFORMANCE DATA (last ${days} days):

Total posts: ${totalPosts}
Total engagement: ${totalEngagement} (avg ${avgEngagement}/post)

Top performing post (${topPost.engagement} engagements):
"${topPost.text}"
Platforms: ${topPost.platforms.join(', ')}

Lowest performing post (${bottomPost.engagement} engagements):
"${bottomPost.text}"

Platform breakdown:
${Object.entries(platformStats).map(([p, s]) => `- ${p}: ${s.posts} posts, ${s.engagement} total engagement, ${Math.round(s.engagement / s.posts)} avg/post`).join('\n')}

Posting times:
${Object.entries(hourBuckets).sort(([, a], [, b]) => (b.engagement / b.count) - (a.engagement / a.count)).slice(0, 3).map(([h, s]) => `- ${parseInt(h) > 12 ? parseInt(h) - 12 : h}${parseInt(h) >= 12 ? 'PM' : 'AM'}: ${s.count} posts, avg ${Math.round(s.engagement / s.count)} engagement`).join('\n')}
`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a social media analytics expert. Analyze this performance data and give actionable insights.

${dataForClaude}

Return valid JSON with this structure:
{
  "summary": "A 2-3 sentence overview of performance — be specific with numbers, not generic.",
  "whatsWorking": "What content/patterns are driving the most engagement. Be specific.",
  "whatsNot": "What's underperforming and why. Be honest but constructive.",
  "tips": ["3-5 specific, actionable recommendations to improve engagement. Each should be one sentence."],
  "bestPlatform": "The platform with the highest avg engagement per post",
  "bestTime": "The best time to post based on the data",
  "contentSuggestion": "A specific content idea based on what's working"
}`,
      }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let insights
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON')
      insights = JSON.parse(jsonMatch[0])
    } catch {
      insights = {
        summary: textBlock.text.slice(0, 300),
        tips: ['Post more consistently to build engagement patterns.'],
      }
    }

    return NextResponse.json({ insights })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Insights generation failed' },
      { status: 500 }
    )
  }
}
