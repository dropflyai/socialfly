import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { publishToMultiplePlatforms } from '@/lib/platforms'

export const maxDuration = 300 // 5 minutes max

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface AutomationRule {
  id: string
  user_id: string
  name: string
  trigger_type: string
  trigger_config: {
    originalType?: string
    schedule?: string
    postsPerDay?: number
    maxNewsItems?: number
    product?: string
    painPoints?: string[]
    [key: string]: unknown
  }
  action_type: string
  action_config: {
    platforms?: string[]
    [key: string]: unknown
  }
  is_active: boolean
  last_triggered_at: string | null
  next_trigger_at: string | null
  trigger_count: number
}

// POST/GET /api/cron/automations — execute due automation rules
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date()

  // Get active rules that are due (next_trigger_at <= now, or never triggered)
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('is_active', true)
    .or(`next_trigger_at.is.null,next_trigger_at.lte.${now.toISOString()}`)
    .order('last_triggered_at', { ascending: true, nullsFirst: true })
    .limit(5) // Process in batches

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rules?.length) {
    return NextResponse.json({ message: 'No automations due', processed: 0 })
  }

  const results = []

  for (const rule of rules as AutomationRule[]) {
    // Check if it's too soon to run again based on schedule
    if (rule.last_triggered_at && !isDue(rule)) {
      continue
    }

    try {
      const result = await executeAutomation(rule, supabase)
      results.push({ ruleId: rule.id, name: rule.name, ...result })

      // Update the rule
      const nextTrigger = calculateNextTrigger(rule.trigger_config.schedule || 'daily')
      await supabase
        .from('automation_rules')
        .update({
          last_triggered_at: now.toISOString(),
          next_trigger_at: nextTrigger.toISOString(),
          trigger_count: (rule.trigger_count || 0) + 1,
          success_count: result.success
            ? (rule as unknown as { success_count: number }).success_count + 1
            : (rule as unknown as { success_count: number }).success_count,
          failure_count: !result.success
            ? (rule as unknown as { failure_count: number }).failure_count + 1
            : (rule as unknown as { failure_count: number }).failure_count,
          updated_at: now.toISOString(),
        })
        .eq('id', rule.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ ruleId: rule.id, name: rule.name, success: false, error: msg })
    }
  }

  return NextResponse.json({
    message: `Processed ${results.length} automations`,
    processed: results.length,
    results,
  })
}

export async function GET(request: NextRequest) {
  return POST(request)
}

// Check if the rule is due based on its schedule
function isDue(rule: AutomationRule): boolean {
  if (!rule.last_triggered_at) return true
  const last = new Date(rule.last_triggered_at)
  const now = new Date()
  const schedule = rule.trigger_config.schedule || 'daily'

  const hoursSinceLast = (now.getTime() - last.getTime()) / (1000 * 60 * 60)

  switch (schedule) {
    case 'daily': return hoursSinceLast >= 20 // ~daily with some buffer
    case 'weekdays': {
      const day = now.getUTCDay()
      return (day >= 1 && day <= 5) && hoursSinceLast >= 20
    }
    case 'weekly': return hoursSinceLast >= 6 * 24
    case 'biweekly': return hoursSinceLast >= 13 * 24
    default: return hoursSinceLast >= 20
  }
}

function calculateNextTrigger(schedule: string): Date {
  const next = new Date()
  switch (schedule) {
    case 'daily': next.setHours(next.getHours() + 24); break
    case 'weekdays': {
      next.setHours(next.getHours() + 24)
      // Skip weekends
      while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
        next.setHours(next.getHours() + 24)
      }
      break
    }
    case 'weekly': next.setDate(next.getDate() + 7); break
    case 'biweekly': next.setDate(next.getDate() + 14); break
    default: next.setHours(next.getHours() + 24)
  }
  return next
}

// Execute a single automation rule
async function executeAutomation(
  rule: AutomationRule,
  supabase: ReturnType<typeof getSupabase>
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const type = rule.trigger_config.originalType || rule.trigger_type
  const platforms = (rule.action_config.platforms || ['instagram']) as string[]

  // Load brand context if available
  let brandContext = ''
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('name, voice_tone, voice_description, target_audience, content_pillars')
    .eq('user_id', rule.user_id)
    .limit(1)
    .single()

  if (brand) {
    brandContext = `Brand: ${brand.name}. Tone: ${brand.voice_tone}. Audience: ${brand.target_audience || 'general'}. Pillars: ${(brand.content_pillars || []).join(', ')}.`
  }

  // Generate content based on automation type
  let prompt: string

  switch (type) {
    case 'content_calendar':
      prompt = `You are a social media manager. Generate a social media post for today.
${brandContext}
Create an engaging post that fits the brand. Include relevant hashtags.
The post should be original, timely, and encourage engagement.`
      break

    case 'ai_news':
      prompt = `You are a social media manager who posts about AI and technology news.
${brandContext}
Generate a post about a recent AI trend, breakthrough, or news story.
Make it informative but accessible. Include your take on why it matters.
Include relevant hashtags.`
      break

    case 'product_ad':
      prompt = `You are a social media marketer creating a promotional post.
${brandContext}
Product: ${rule.trigger_config.product || 'our main product'}
Pain points to address: ${(rule.trigger_config.painPoints || ['saving time', 'reducing costs']).join(', ')}
Create a pain-point driven promotional post. Don't be salesy — be helpful.
Include a subtle call-to-action and relevant hashtags.`
      break

    case 'repurpose':
      // Find the top performing post and adapt it
      const { data: topPost } = await supabase
        .from('scheduled_posts')
        .select('custom_content, platforms, metrics')
        .eq('user_id', rule.user_id)
        .eq('status', 'posted')
        .order('posted_at', { ascending: false })
        .limit(10)

      const bestPost = topPost?.[0]
      if (!bestPost?.custom_content) {
        return { success: false, error: 'No previous posts to repurpose' }
      }

      prompt = `You are a social media manager repurposing a previous post.
${brandContext}
Original post: "${(bestPost.custom_content as { text?: string }).text || ''}"
Original platforms: ${(bestPost.platforms || []).join(', ')}
Target platforms: ${platforms.join(', ')}

Rewrite this post for the target platforms. Make it fresh — don't copy word for word.
Adapt the tone and format for each platform. Include relevant hashtags.`
      break

    default:
      prompt = `You are a social media manager. Generate an engaging social media post.
${brandContext}
Create a post that fits the brand and encourages engagement. Include hashtags.`
  }

  // Generate content with Claude
  const platformSpecs: Record<string, string> = {
    instagram: 'Instagram: storytelling, emoji-friendly, 5-15 hashtags at end',
    facebook: 'Facebook: community-focused, shareable, 2-3 hashtags',
    linkedin: 'LinkedIn: professional, thought leadership, 3-5 hashtags',
    tiktok: 'TikTok: max 150 chars, trendy, 3-5 hashtags',
    twitter: 'Twitter/X: max 280 chars, punchy, 1-3 hashtags',
  }

  const platformInstructions = platforms
    .map(p => platformSpecs[p] || `${p}: general social media post`)
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `${prompt}

Generate platform-specific versions for: ${platforms.join(', ')}

Platform specs:
${platformInstructions}

Return valid JSON:
{
  "text": "the main post text (use the first platform's version)",
  "variants": {
    "${platforms[0]}": { "text": "platform text", "hashtags": ["#tag1"] }
  }
}`,
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return { success: false, error: 'No response from Claude' }
  }

  let generated: { text: string; variants?: Record<string, { text: string; hashtags?: string[] }> }
  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    generated = JSON.parse(jsonMatch[0])
  } catch {
    // Use raw text as fallback
    generated = { text: textBlock.text.slice(0, 2000) }
  }

  const postText = generated.variants?.[platforms[0]]?.text || generated.text

  // Save as a scheduled post (publish immediately or schedule for optimal time)
  const { data: post, error: postError } = await supabase
    .from('scheduled_posts')
    .insert({
      user_id: rule.user_id,
      platforms,
      status: 'scheduled',
      scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min from now
      custom_content: {
        text: postText,
        media_urls: [],
        automation_rule_id: rule.id,
        automation_type: type,
      },
    })
    .select()
    .single()

  if (postError) {
    return { success: false, error: `Failed to create post: ${postError.message}` }
  }

  return { success: true, postId: post.id }
}
