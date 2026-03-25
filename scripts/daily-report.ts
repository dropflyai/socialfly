#!/usr/bin/env npx tsx
/**
 * Daily Performance Report — Local Cron Script
 *
 * Runs every evening at 8 PM PST on the Mac Mini.
 * Pulls today's post performance from Instagram, builds a report,
 * and sends it to dropflyai@gmail.com and erik@dropfly.io.
 *
 * Crontab entry:
 * 0 20 * * * cd /Users/dropfly/Projects/socialfly && npx tsx scripts/daily-report.ts >> logs/report.log 2>&1
 */

import { initEngine } from '../src/lib/engine/index.js'
import { getSupabase } from '../src/lib/engine/config.js'

// Load env from .env.local
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

const INSTAGRAM_TOKEN = process.env.INSTAGRAM_PAGE_TOKEN || ''
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || ''
const GRAPH_API = 'https://graph.facebook.com/v21.0'
const USER_ID = '40ef93a5-1212-4878-b2b6-7285a39fc40c'
const REPORT_EMAILS = ['dropflyai@gmail.com', 'erik@dropfly.io']

initEngine()

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`)

async function main() {
  log('=== DAILY REPORT START ===')
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  // Get today's posts
  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('status', 'posted')
    .gte('posted_at', today + 'T00:00:00Z')
    .lte('posted_at', today + 'T23:59:59Z')
    .order('posted_at', { ascending: true })

  const totalPosts = posts?.length || 0
  log(`Found ${totalPosts} posts today`)

  // Fetch engagement for each post
  interface PostMetrics { id: string; text: string; likes: number; comments: number; impressions: number; reach: number; postedAt: string }
  const postMetrics: PostMetrics[] = []

  for (const post of (posts || [])) {
    const igPostId = post.platform_post_ids?.instagram
    if (!igPostId) continue

    try {
      // Get basic metrics
      const metricsRes = await fetch(
        `${GRAPH_API}/${igPostId}?fields=like_count,comments_count,timestamp&access_token=${INSTAGRAM_TOKEN}`
      )
      const metrics = await metricsRes.json() as { like_count?: number; comments_count?: number; timestamp?: string }

      // Get insights
      let impressions = 0, reach = 0
      try {
        const insightsRes = await fetch(
          `${GRAPH_API}/${igPostId}/insights?metric=impressions,reach&access_token=${INSTAGRAM_TOKEN}`
        )
        const insights = await insightsRes.json() as { data?: { name: string; values: { value: number }[] }[] }
        for (const metric of (insights.data || [])) {
          if (metric.name === 'impressions') impressions = metric.values?.[0]?.value || 0
          if (metric.name === 'reach') reach = metric.values?.[0]?.value || 0
        }
      } catch { /* insights may not be available yet */ }

      postMetrics.push({
        id: igPostId,
        text: post.custom_content?.text?.slice(0, 80) || 'No caption',
        likes: metrics.like_count || 0,
        comments: metrics.comments_count || 0,
        impressions,
        reach,
        postedAt: post.posted_at,
      })

      // Store metrics back to DB
      await supabase.from('scheduled_posts').update({
        metrics: { instagram: { likes: metrics.like_count || 0, comments: metrics.comments_count || 0, impressions, reach } }
      }).eq('id', post.id)
    } catch (e) {
      log(`Metrics fetch failed for ${igPostId}: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  // Account-level insights
  let followerCount = 0
  try {
    const accountRes = await fetch(
      `${GRAPH_API}/${INSTAGRAM_ACCOUNT_ID}?fields=followers_count&access_token=${INSTAGRAM_TOKEN}`
    )
    const accountData = await accountRes.json() as { followers_count?: number }
    followerCount = accountData.followers_count || 0
  } catch { /* */ }

  // Calculate totals
  const totalLikes = postMetrics.reduce((s, p) => s + p.likes, 0)
  const totalComments = postMetrics.reduce((s, p) => s + p.comments, 0)
  const totalImpressions = postMetrics.reduce((s, p) => s + p.impressions, 0)
  const totalReach = postMetrics.reduce((s, p) => s + p.reach, 0)
  const topPost = postMetrics.sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))[0]

  // Build HTML report
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;"><tr><td align="center" style="padding:20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">

<tr><td style="background:linear-gradient(135deg,#1a1a2e,#0f3460);padding:30px 40px;">
<h1 style="color:#fff;font-size:20px;margin:0;">DropFly Daily Social Report</h1>
<p style="color:#a8b2d1;font-size:14px;margin:6px 0 0;">${today} | Instagram</p>
</td></tr>

<tr><td style="padding:20px 40px;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="text-align:center;padding:12px;background:#f0f9ff;border-radius:8px;width:25%;">
<p style="font-size:24px;font-weight:700;color:#1a1a2e;margin:0;">${totalPosts}</p>
<p style="font-size:11px;color:#888;margin:4px 0 0;">Posts</p>
</td>
<td style="text-align:center;padding:12px;background:#f0fdf4;border-radius:8px;width:25%;">
<p style="font-size:24px;font-weight:700;color:#16a34a;margin:0;">${totalLikes}</p>
<p style="font-size:11px;color:#888;margin:4px 0 0;">Likes</p>
</td>
<td style="text-align:center;padding:12px;background:#fef3c7;border-radius:8px;width:25%;">
<p style="font-size:24px;font-weight:700;color:#d97706;margin:0;">${totalComments}</p>
<p style="font-size:11px;color:#888;margin:4px 0 0;">Comments</p>
</td>
<td style="text-align:center;padding:12px;background:#faf5ff;border-radius:8px;width:25%;">
<p style="font-size:24px;font-weight:700;color:#7c3aed;margin:0;">${totalImpressions}</p>
<p style="font-size:11px;color:#888;margin:4px 0 0;">Impressions</p>
</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:10px 40px;">
<p style="font-size:13px;color:#666;">Reach: <strong>${totalReach}</strong> | Followers: <strong>${followerCount}</strong></p>
</td></tr>

${topPost ? `<tr><td style="padding:10px 40px;">
<div style="background:#f8f9fa;border-radius:8px;padding:16px;border-left:4px solid #16a34a;">
<p style="margin:0;font-size:12px;color:#888;">TOP POST</p>
<p style="margin:4px 0;font-size:14px;color:#333;">"${topPost.text}..."</p>
<p style="margin:0;font-size:13px;color:#16a34a;">${topPost.likes} likes, ${topPost.comments} comments</p>
</div>
</td></tr>` : ''}

<tr><td style="padding:10px 40px 20px;">
<h3 style="font-size:14px;color:#1a1a2e;margin:0 0 8px;">Post Breakdown</h3>
${postMetrics.map(p => `<p style="font-size:12px;color:#555;margin:4px 0;padding:6px;background:#f8f9fa;border-radius:4px;">${new Date(p.postedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — "${p.text}..." — ${p.likes}L ${p.comments}C ${p.impressions}I</p>`).join('')}
</td></tr>

<tr><td style="background:#f8f9fa;padding:16px 40px;border-top:1px solid #e8e8e8;">
<p style="color:#888;font-size:11px;margin:0;text-align:center;">SocialFly Autopilot Report | DropFly Inc.</p>
</td></tr>

</table></td></tr></table></body></html>`

  // Log report to autopilot_runs
  await supabase.from('autopilot_runs').insert({
    user_id: USER_ID,
    timestamp: new Date().toISOString(),
    posts_created: totalPosts,
    posts_scheduled: 0,
    repurposed: 0,
    skipped: 0,
    errors: [],
    insights: [
      `${totalPosts} posts, ${totalLikes} likes, ${totalComments} comments`,
      `Total reach: ${totalReach}, impressions: ${totalImpressions}`,
      topPost ? `Top post: "${topPost.text}..." (${topPost.likes} likes)` : 'No posts today',
    ],
    actions: postMetrics.map(p => ({
      type: 'report' as const,
      platform: 'instagram' as const,
      reason: `${p.text} — ${p.likes}L ${p.comments}C`,
      success: true,
    })),
  })

  // Send email report (log for now — Gmail OAuth sends from MCP session)
  await supabase.from('mcp_agent_interactions').insert({
    business_id: null,
    interaction_type: 'email',
    direction: 'outbound',
    subject: 'daily_report',
    content: JSON.stringify({
      to: REPORT_EMAILS,
      subject: `DropFly Daily Social Report — ${today}`,
      html,
    }),
    metadata: { report_date: today, total_posts: totalPosts, total_likes: totalLikes },
  })

  log(`Report: ${totalPosts} posts, ${totalLikes} likes, ${totalComments} comments, ${totalImpressions} impressions`)
  log('=== DAILY REPORT COMPLETE ===')
}

main().catch(e => {
  log('FATAL: ' + (e instanceof Error ? e.message : 'unknown'))
  process.exit(1)
})
