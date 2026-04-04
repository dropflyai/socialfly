import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits, checkCredits } from '@/lib/credits'

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
  const config = rule.trigger_config

  // User-configured settings
  const topics = (config.topics as string[]) || []
  const userTone = (config.tone as string) || 'Professional'
  const includeImages = config.includeImages !== false
  const autoPublish = config.autoPublish !== false
  const contentExamples = (config.contentExamples as string) || ''
  const userIndustry = (config.industry as string) || ''

  // Check credits before generating (1 for text + 5 for image if enabled)
  const totalCreditsNeeded = 1 + (includeImages ? 5 : 0)
  const creditCheck = await checkCredits(rule.user_id, 'caption')
  if (!creditCheck.allowed || creditCheck.creditsRemaining < totalCreditsNeeded) {
    return { success: false, error: `Insufficient credits (need ${totalCreditsNeeded}, have ${creditCheck.creditsRemaining}). Automation paused.` }
  }

  // Deduct caption credit
  await deductCredits(rule.user_id, 'caption', { automation_rule_id: rule.id })

  // Load brand context if available
  let brandContext = ''
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('name, voice_tone, voice_description, target_audience, content_pillars')
    .eq('user_id', rule.user_id)
    .limit(1)
    .single()

  if (brand) {
    brandContext = `Brand: ${brand.name}. Tone: ${brand.voice_tone || userTone}. Audience: ${brand.target_audience || 'general'}. Content pillars: ${(brand.content_pillars || []).join(', ')}.`
  } else {
    brandContext = `Tone: ${userTone}.`
  }

  // Pick a random topic for this run if multiple provided
  const todaysTopic = topics.length > 0
    ? topics[Math.floor(Math.random() * topics.length)]
    : ''

  // Build the prompt based on automation type
  let prompt: string

  switch (type) {
    case 'content_calendar':
      prompt = `You are a social media manager creating today's post.
${brandContext}
${todaysTopic ? `Today's topic/theme: ${todaysTopic}` : 'Choose an engaging topic that fits the brand.'}
${contentExamples ? `\nHere are example posts the user likes (match this style):\n${contentExamples}` : ''}

Create an engaging, original post. Be specific — don't be generic.
The tone should be ${userTone.toLowerCase()}.
Include relevant hashtags.`
      break

    case 'ai_news':
      prompt = `You are a social media manager who posts about industry news and trends.
${brandContext}
Industry focus: ${userIndustry || todaysTopic || 'technology and AI'}
${contentExamples ? `\nStyle reference:\n${contentExamples}` : ''}

Generate a post about a current trend, insight, or development in this space.
Don't make up fake news — share a real insight or perspective.
The tone should be ${userTone.toLowerCase()}.
Make it informative but accessible. Include your take on why it matters.
Include relevant hashtags.`
      break

    case 'product_ad': {
      const product = (config.product as string) || ''
      const productDesc = (config.productDescription as string) || ''
      const pains = (config.painPoints as string[]) || ['saving time', 'reducing costs']
      const todaysPain = pains[Math.floor(Math.random() * pains.length)]

      prompt = `You are a social media marketer creating a promotional post.
${brandContext}
Product: ${product || 'our product'}
What it does: ${productDesc || 'helps businesses grow'}
Today's pain point to address: ${todaysPain}
${contentExamples ? `\nStyle reference:\n${contentExamples}` : ''}

Create a pain-point driven post that resonates with the audience.
Don't be salesy — be helpful and relatable. Lead with the problem, then hint at the solution.
The tone should be ${userTone.toLowerCase()}.
Include a subtle call-to-action and relevant hashtags.`
      break
    }

    case 'repurpose': {
      const { data: topPosts } = await supabase
        .from('scheduled_posts')
        .select('custom_content, platforms')
        .eq('user_id', rule.user_id)
        .eq('status', 'posted')
        .order('posted_at', { ascending: false })
        .limit(10)

      const bestPost = topPosts?.[Math.floor(Math.random() * Math.min(topPosts?.length || 1, 5))]
      if (!bestPost?.custom_content) {
        return { success: false, error: 'No previous posts to repurpose' }
      }

      prompt = `You are a social media manager repurposing a previous post.
${brandContext}
Original post: "${(bestPost.custom_content as { text?: string }).text || ''}"
Original platforms: ${(bestPost.platforms || []).join(', ')}
Target platforms: ${platforms.join(', ')}

Rewrite this for the target platforms. Make it fresh — change the angle, not just the words.
The tone should be ${userTone.toLowerCase()}.
Include relevant hashtags.`
      break
    }

    default:
      prompt = `You are a social media manager. Generate an engaging social media post.
${brandContext}
${todaysTopic ? `Topic: ${todaysTopic}` : ''}
The tone should be ${userTone.toLowerCase()}.
Create a post that encourages engagement. Include hashtags.`
  }

  // Generate content with Claude
  const platformSpecs: Record<string, string> = {
    instagram: 'Instagram: storytelling, emoji-friendly, 5-15 hashtags at end',
    facebook: 'Facebook: community-focused, shareable, 2-3 hashtags',
    linkedin: 'LinkedIn: professional, thought leadership, 3-5 hashtags. Hook in first line.',
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
  "imagePrompt": "a short description of an image that would complement this post (for AI image generation)",
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

  let generated: { text: string; imagePrompt?: string; variants?: Record<string, { text: string; hashtags?: string[] }> }
  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    generated = JSON.parse(jsonMatch[0])
  } catch {
    generated = { text: textBlock.text.slice(0, 2000) }
  }

  const postText = generated.variants?.[platforms[0]]?.text || generated.text
  const mediaUrls: string[] = []

  // Generate AI image if enabled
  if (includeImages && generated.imagePrompt) {
    try {
      // Deduct image generation credit
      await deductCredits(rule.user_id, 'image_generate', { automation_rule_id: rule.id })

      const { fal } = await import('@fal-ai/client')
      fal.config({ credentials: process.env.FAL_KEY })

      const imgResult = await fal.subscribe('fal-ai/flux/schnell', {
        input: {
          prompt: generated.imagePrompt,
          image_size: { width: 1080, height: 1080 },
          num_images: 1,
        },
      })

      const images = (imgResult.data as { images?: { url: string }[] }).images
      if (images?.[0]?.url) {
        mediaUrls.push(images[0].url)
      }
    } catch (imgErr) {
      console.error('Automation image generation failed:', imgErr)
      // Continue without image — not a hard failure
    }
  }

  // Save as scheduled post or draft
  const status = autoPublish ? 'scheduled' : 'draft'
  const scheduledFor = autoPublish
    ? new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min from now
    : null

  const { data: post, error: postError } = await supabase
    .from('scheduled_posts')
    .insert({
      user_id: rule.user_id,
      platforms,
      status,
      scheduled_for: scheduledFor,
      custom_content: {
        text: postText,
        media_urls: mediaUrls,
        media_type: mediaUrls.length > 0 ? 'image' : undefined,
        automation_rule_id: rule.id,
        automation_type: type,
        variants: generated.variants,
      },
    })
    .select()
    .single()

  if (postError) {
    return { success: false, error: `Failed to create post: ${postError.message}` }
  }

  return { success: true, postId: post.id }
}
