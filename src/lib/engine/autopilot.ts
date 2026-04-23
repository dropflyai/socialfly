/**
 * Marketing Autopilot Engine
 *
 * The brain that makes SocialFly a platform instead of a toolbox.
 * Runs on a schedule (cron) and makes intelligent decisions about:
 * - What to post today (from the content calendar)
 * - When to post (optimal timing from analytics)
 * - What's working (auto-repurpose top performers)
 * - What's not working (shift content mix)
 * - Weekly digest generation
 *
 * This is what runs your marketing while you sleep.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getConfig, getSupabase } from './config'
import { generateAndPublish } from './pipeline'
import { getAnalytics, getPerformanceSummary } from './analytics'
import { getContentCalendars, executeCalendarEntry } from './calendar'
import { listCampaigns, getCampaignMetrics } from './campaigns'
import { generateContent, generateImage } from './generate'
import { publish, schedule, getPostHistory } from './publish'
import { loadBrandVoice, buildBrandContext } from './brand'
import type { Platform, ContentCalendarEntry, PlatformAnalytics } from './types'

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getConfig().anthropicApiKey })
}

// ============================================================================
// Autopilot State
// ============================================================================

interface AutopilotConfig {
  userId: string
  enabled: boolean
  platforms: Platform[]
  brandId?: string
  // Controls
  autoPublish: boolean        // Actually publish, or just draft?
  maxPostsPerDay: number      // Safety limit
  repurposeThreshold: number  // Engagement rate % to trigger repurpose
  quietHoursStart: number     // Hour (UTC) to stop posting
  quietHoursEnd: number       // Hour (UTC) to resume posting
  // Content preferences
  defaultTone: string
  contentMix: {               // Target % breakdown
    educational: number
    entertaining: number
    inspirational: number
    promotional: number
    behindTheScenes: number
  }
  // Cross-product marketing
  products: ProductConfig[]
}

interface ProductConfig {
  name: string                // e.g., "VoiceFly"
  description: string         // What it does
  targetAudience: string      // Who it's for
  keyFeatures: string[]       // Selling points
  hashtags: string[]          // Product-specific hashtags
  weight: number              // How often to promote (0-1)
}

interface AutopilotRunResult {
  timestamp: string
  actions: AutopilotAction[]
  postsCreated: number
  postsScheduled: number
  repurposed: number
  skipped: number
  errors: string[]
  insights: string[]
}

interface AutopilotAction {
  type: 'calendar_execute' | 'repurpose' | 'smart_post' | 'digest' | 'skip'
  platform?: Platform
  reason: string
  postId?: string
  success: boolean
  error?: string
}

// ============================================================================
// Core Autopilot Functions
// ============================================================================

/**
 * Run the autopilot cycle. Called by cron or manually.
 * This is the main entry point — it decides what to do and does it.
 */
export async function runAutopilot(
  config: AutopilotConfig
): Promise<AutopilotRunResult> {
  const result: AutopilotRunResult = {
    timestamp: new Date().toISOString(),
    actions: [],
    postsCreated: 0,
    postsScheduled: 0,
    repurposed: 0,
    skipped: 0,
    errors: [],
    insights: [],
  }

  if (!config.enabled) {
    result.actions.push({ type: 'skip', reason: 'Autopilot is disabled', success: true })
    return result
  }

  // Check quiet hours
  const currentHour = new Date().getUTCHours()
  if (config.quietHoursStart !== config.quietHoursEnd) {
    const inQuietHours = config.quietHoursStart < config.quietHoursEnd
      ? currentHour >= config.quietHoursStart && currentHour < config.quietHoursEnd
      : currentHour >= config.quietHoursStart || currentHour < config.quietHoursEnd

    if (inQuietHours) {
      result.actions.push({ type: 'skip', reason: `Quiet hours (${config.quietHoursStart}:00-${config.quietHoursEnd}:00 UTC)`, success: true })
      return result
    }
  }

  try {
    // Step 1: Check today's calendar entries
    await executeCalendarPosts(config, result)

    // Step 2: Check for top performers to repurpose
    await repurposeTopPerformers(config, result)

    // Step 3: Smart gap filling — if we haven't hit maxPostsPerDay, generate smart content
    await smartGapFill(config, result)

    // Step 4: Generate insights
    await generateInsights(config, result)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Autopilot cycle error: ${message}`)
  }

  // Log the run
  await logAutopilotRun(config.userId, result)

  return result
}

/**
 * Execute any calendar entries scheduled for today.
 */
async function executeCalendarPosts(
  config: AutopilotConfig,
  result: AutopilotRunResult
): Promise<void> {
  const calendars = await getContentCalendars(config.userId, { active: true })
  const today = new Date().toISOString().split('T')[0]

  for (const calendar of calendars) {
    if (!calendar.id) continue

    for (let i = 0; i < calendar.entries.length; i++) {
      const entry = calendar.entries[i]

      // Only execute today's planned entries
      if (entry.date !== today || entry.status !== 'planned') continue

      // Respect max posts per day
      if (result.postsCreated + result.postsScheduled >= config.maxPostsPerDay) {
        result.actions.push({
          type: 'skip',
          reason: `Max posts per day (${config.maxPostsPerDay}) reached`,
          success: true,
        })
        return
      }

      try {
        if (config.autoPublish) {
          const execResult = await executeCalendarEntry(config.userId, calendar.id, i)
          result.actions.push({
            type: 'calendar_execute',
            platform: entry.platform,
            reason: `Calendar entry: ${entry.topic}`,
            postId: execResult.postId,
            success: execResult.success,
            error: execResult.error,
          })

          if (execResult.success) {
            result.postsCreated++
          }
        } else {
          result.actions.push({
            type: 'calendar_execute',
            platform: entry.platform,
            reason: `[Draft mode] Would post: ${entry.topic}`,
            success: true,
          })
          result.postsScheduled++
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        result.actions.push({
          type: 'calendar_execute',
          platform: entry.platform,
          reason: `Calendar entry failed: ${entry.topic}`,
          success: false,
          error: message,
        })
        result.errors.push(message)
      }
    }
  }
}

/**
 * Find top-performing posts and repurpose them to other platforms.
 */
async function repurposeTopPerformers(
  config: AutopilotConfig,
  result: AutopilotRunResult
): Promise<void> {
  if (result.postsCreated >= config.maxPostsPerDay) return

  // Get recent analytics
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const analytics = await getAnalytics(config.userId, { since })

  for (const platformAnalytics of analytics) {
    if (platformAnalytics.engagementRate < config.repurposeThreshold) continue

    for (const topPost of platformAnalytics.topPosts.slice(0, 2)) {
      if (result.postsCreated >= config.maxPostsPerDay) return

      // Find platforms this post HASN'T been published to
      const otherPlatforms = config.platforms.filter(
        p => p !== platformAnalytics.platform
      )

      if (otherPlatforms.length === 0) continue

      // Get the original post content
      const history = await getPostHistory(config.userId, { limit: 50, since })
      const originalPost = history.find(p => p.id === topPost.postId)

      if (!originalPost || !originalPost.content.text) continue

      // Check if already repurposed (simple dedup by similar text)
      const recentPosts = await getPostHistory(config.userId, { limit: 20 })
      const alreadyRepurposed = recentPosts.some(p =>
        p.content.text && originalPost.content.text &&
        p.content.text.slice(0, 50) === originalPost.content.text.slice(0, 50) &&
        p.id !== originalPost.id
      )

      if (alreadyRepurposed) continue

      // Repurpose: generate new content from the same topic for different platforms
      try {
        const targetPlatform = otherPlatforms[0]

        if (config.autoPublish) {
          const repurposeResult = await generateAndPublish({
            topic: `Repurpose this successful post for ${targetPlatform}: "${originalPost.content.text.slice(0, 200)}"`,
            platforms: [targetPlatform],
            userId: config.userId,
            includeImage: originalPost.content.mediaUrls.length > 0,
            brandId: config.brandId,
            tone: config.defaultTone,
          })

          result.actions.push({
            type: 'repurpose',
            platform: targetPlatform,
            reason: `Repurposed top post from ${platformAnalytics.platform} (${topPost.engagements} engagements)`,
            postId: repurposeResult.scheduledPost?.id || repurposeResult.publishResult?.contentId,
            success: repurposeResult.success,
            error: repurposeResult.error,
          })

          if (repurposeResult.success) {
            result.repurposed++
            result.postsCreated++
          }
        } else {
          result.actions.push({
            type: 'repurpose',
            platform: targetPlatform,
            reason: `[Draft] Would repurpose to ${targetPlatform}: "${originalPost.content.text.slice(0, 80)}..."`,
            success: true,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Repurpose failed: ${message}`)
      }
    }
  }
}

/**
 * Smart gap filling — if we still have room for posts today,
 * generate content based on content mix targets and product rotation.
 */
async function smartGapFill(
  config: AutopilotConfig,
  result: AutopilotRunResult
): Promise<void> {
  if (result.postsCreated >= config.maxPostsPerDay) return
  if (config.products.length === 0) return

  // Pick a product to promote based on weights
  const product = pickWeightedProduct(config.products)
  if (!product) return

  // Determine content pillar based on mix
  const pillar = pickContentPillar(config.contentMix)

  // Pick the best platform based on analytics
  const bestPlatform = await pickBestPlatform(config)

  if (!bestPlatform) return

  const topic = buildSmartTopic(product, pillar)

  try {
    if (config.autoPublish) {
      const postResult = await generateAndPublish({
        topic,
        platforms: [bestPlatform],
        userId: config.userId,
        includeImage: true,
        brandId: config.brandId,
        tone: config.defaultTone,
      })

      result.actions.push({
        type: 'smart_post',
        platform: bestPlatform,
        reason: `Smart fill: ${product.name} / ${pillar} → ${bestPlatform}`,
        postId: postResult.scheduledPost?.id || postResult.publishResult?.contentId,
        success: postResult.success,
        error: postResult.error,
      })

      if (postResult.success) result.postsCreated++
    } else {
      result.actions.push({
        type: 'smart_post',
        platform: bestPlatform,
        reason: `[Draft] Would post: ${product.name} / ${pillar} → ${bestPlatform}`,
        success: true,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Smart fill failed: ${message}`)
  }
}

/**
 * Generate insights from analytics data.
 */
async function generateInsights(
  config: AutopilotConfig,
  result: AutopilotRunResult
): Promise<void> {
  try {
    const summary = await getPerformanceSummary(config.userId, 7)

    if (summary.totalPosts === 0) {
      result.insights.push('No posts in the last 7 days — content calendar may need attention')
      return
    }

    if (summary.avgEngagementRate < 1) {
      result.insights.push('Engagement rate below 1% — consider more question-based or value-driven content')
    }

    if (summary.avgEngagementRate > 5) {
      result.insights.push(`Strong engagement at ${summary.avgEngagementRate.toFixed(1)}% — double down on current content mix`)
    }

    // Platform comparison
    const platforms = Object.entries(summary.platformBreakdown)
    if (platforms.length > 1) {
      const sorted = platforms.sort(([, a], [, b]) => b.engagements - a.engagements)
      const best = sorted[0]
      const worst = sorted[sorted.length - 1]

      if (best[1].engagements > worst[1].engagements * 2) {
        result.insights.push(
          `${best[0]} outperforming ${worst[0]} by ${Math.round(best[1].engagements / Math.max(worst[1].engagements, 1))}x — consider shifting more content there`
        )
      }
    }

    if (summary.topPerforming.length > 0) {
      const topPost = summary.topPerforming[0]
      result.insights.push(`Top post: "${topPost.text.slice(0, 60)}..." on ${topPost.platform} (${topPost.engagements} engagements)`)
    }
  } catch {
    // Insights are non-critical
  }
}

/**
 * Generate a weekly marketing digest — summary of performance + recommendations.
 */
export async function generateWeeklyDigest(
  userId: string,
  brandId?: string
): Promise<{
  summary: string
  metrics: { posts: number; impressions: number; engagements: number; engagementRate: number }
  topPosts: { text: string; platform: string; engagements: number }[]
  recommendations: string[]
  nextWeekSuggestions: string[]
}> {
  const anthropic = getAnthropicClient()

  // Gather data
  const summary = await getPerformanceSummary(userId, 7)
  const analytics = await getAnalytics(userId, {
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  const campaigns = await listCampaigns(userId, { status: 'active' })
  const campaignData = await Promise.all(
    campaigns.slice(0, 5).map(async c => ({
      name: c.name,
      metrics: await getCampaignMetrics(userId, c.id).catch(() => null),
    }))
  )

  // Load brand context
  let brandContext = ''
  if (brandId) {
    const brand = await loadBrandVoice(userId, brandId)
    if (brand) brandContext = buildBrandContext(brand)
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are a marketing strategist analyzing weekly social media performance.
${brandContext ? `\n${brandContext}\n` : ''}
Generate actionable insights and recommendations. Be specific and data-driven.

Return valid JSON:
{
  "summary": "2-3 sentence executive summary",
  "recommendations": ["specific recommendation 1", "specific recommendation 2"],
  "next_week_suggestions": ["content topic 1", "content topic 2", "content topic 3"]
}`,
    messages: [{
      role: 'user',
      content: `Weekly performance data:
- Total posts: ${summary.totalPosts}
- Total impressions: ${summary.totalImpressions}
- Total engagements: ${summary.totalEngagements}
- Avg engagement rate: ${summary.avgEngagementRate.toFixed(2)}%
- Platform breakdown: ${JSON.stringify(summary.platformBreakdown)}
- Top posts: ${JSON.stringify(summary.topPerforming.slice(0, 5))}
- Active campaigns: ${JSON.stringify(campaignData.filter(c => c.metrics))}
- Platform analytics: ${JSON.stringify(analytics.map(a => ({
  platform: a.platform,
  engagementRate: a.engagementRate,
  bestTimes: a.bestPostingTimes,
  frequency: a.postingFrequency,
})))}`,
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No response')

  let jsonStr = textBlock.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  const generated = JSON.parse(jsonStr)

  return {
    summary: generated.summary,
    metrics: {
      posts: summary.totalPosts,
      impressions: summary.totalImpressions,
      engagements: summary.totalEngagements,
      engagementRate: summary.avgEngagementRate,
    },
    topPosts: summary.topPerforming.slice(0, 5).map(p => ({
      text: p.text,
      platform: p.platform,
      engagements: p.engagements,
    })),
    recommendations: generated.recommendations || [],
    nextWeekSuggestions: generated.next_week_suggestions || [],
  }
}

// ============================================================================
// Smart Routing Helpers
// ============================================================================

/**
 * Pick the best platform to post on right now based on analytics + recency.
 */
async function pickBestPlatform(config: AutopilotConfig): Promise<Platform | null> {
  if (config.platforms.length === 0) return null
  if (config.platforms.length === 1) return config.platforms[0]

  try {
    const analytics = await getAnalytics(config.userId, {
      platforms: config.platforms,
      since: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    })

    // Score each platform: engagement rate + inverse of posting frequency (spread it out)
    let bestPlatform: Platform = config.platforms[0]
    let bestScore = -1

    for (const pa of analytics) {
      // Higher engagement = good, lower frequency = good (spread posts out)
      const score = pa.engagementRate + (1 / Math.max(pa.postingFrequency, 0.1))
      if (score > bestScore) {
        bestScore = score
        bestPlatform = pa.platform
      }
    }

    return bestPlatform
  } catch {
    // Fallback: round-robin
    const day = new Date().getDate()
    return config.platforms[day % config.platforms.length]
  }
}

function pickWeightedProduct(products: ProductConfig[]): ProductConfig | null {
  if (products.length === 0) return null

  const totalWeight = products.reduce((sum, p) => sum + p.weight, 0)
  let random = Math.random() * totalWeight

  for (const product of products) {
    random -= product.weight
    if (random <= 0) return product
  }

  return products[0]
}

function pickContentPillar(mix: AutopilotConfig['contentMix']): string {
  const pillars = Object.entries(mix)
  const total = pillars.reduce((sum, [, weight]) => sum + weight, 0)
  let random = Math.random() * total

  for (const [pillar, weight] of pillars) {
    random -= weight
    if (random <= 0) return pillar
  }

  return 'educational'
}

function buildSmartTopic(product: ProductConfig, pillar: string): string {
  // DreamFly-specific parent-focused topics that convert
  const isDreamFly = product.name.toLowerCase().includes('dreamfly') || product.name.toLowerCase().includes('dream fly')

  if (isDreamFly) {
    const dreamflyTemplates: Record<string, string[]> = {
      educational: [
        'Why personalized bedtime stories help kids fall asleep faster — and how parents are using DreamFly to make it happen. End with: Try a free story tonight, link in bio.',
        '5 signs your toddler needs a better bedtime routine (and one easy fix). End with: Your first story is free — link in bio.',
        'How reading your child\'s name in a story builds confidence and early literacy. End with: Try it free, link in bio.',
      ],
      entertaining: [
        'POV: Your 3-year-old just heard their name in a bedtime story for the first time. Their face = priceless. End with: Try it free — link in bio.',
        'Name one thing harder than getting a toddler to sleep. We\'ll wait. (We also have a solution — link in bio)',
        'When your kid asks for ANOTHER story tonight instead of fighting bedtime. Parent win. End with: Free first story — link in bio.',
      ],
      inspirational: [
        'What if bedtime was the part of the day you actually looked forward to? DreamFly makes it happen — one personalized story at a time. Link in bio.',
        'Screen time you can feel good about: personalized stories that use your child\'s name, age, and interests. Try it free — link in bio.',
        'Every child deserves to be the hero of their own story. DreamFly creates personalized adventures just for them. Free first story — link in bio.',
      ],
      promotional: [
        'DreamFly creates personalized bedtime stories with YOUR child\'s name, favorite animal, and a nightly emotional check-in. First story is free. Link in bio.',
        'Bedtime battles? DreamFly\'s AI creates calming, personalized stories that help kids ages 2-10 wind down. Try it free tonight — link in bio.',
      ],
      behindTheScenes: [
        'We built DreamFly because we were tired of the same 3 bedtime stories on repeat. Now every night is a new adventure with their name in it. Try it free — link in bio.',
        'The story behind DreamFly: built by parents, for parents. Because bedtime should be magical, not stressful. Free first story — link in bio.',
      ],
    }

    const options = dreamflyTemplates[pillar] || dreamflyTemplates.educational
    return options[Math.floor(Math.random() * options.length)]
  }

  const templates: Record<string, string[]> = {
    educational: [
      `How ${product.name} helps ${product.targetAudience} with ${product.keyFeatures[0] || 'their business'}`,
      `3 ways ${product.targetAudience} can benefit from ${product.name}`,
      `Did you know? ${product.keyFeatures[Math.floor(Math.random() * product.keyFeatures.length)] || product.description}`,
    ],
    entertaining: [
      `The moment when you realize ${product.name} can handle ${product.keyFeatures[0] || 'everything'} for you`,
      `POV: You just set up ${product.name} and it's already working while you sleep`,
    ],
    inspirational: [
      `How ${product.targetAudience} are transforming their business with AI — featuring ${product.name}`,
      `The future of ${product.targetAudience.toLowerCase()} is here. ${product.description}`,
    ],
    promotional: [
      `Introducing ${product.name}: ${product.description}. Try it today.`,
      `${product.name} — ${product.keyFeatures.slice(0, 3).join(', ')}. Built for ${product.targetAudience}.`,
    ],
    behindTheScenes: [
      `Building ${product.name}: here's why we chose to focus on ${product.targetAudience}`,
      `A look at how ${product.name} works behind the scenes`,
    ],
  }

  const options = templates[pillar] || templates.educational
  return options[Math.floor(Math.random() * options.length)]
}

// ============================================================================
// Autopilot Configuration Management
// ============================================================================

/**
 * Get or create autopilot config for a user.
 */
export async function getAutopilotConfig(userId: string): Promise<AutopilotConfig> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('autopilot_configs')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (data) return mapAutopilotConfig(data)

  // Return defaults
  return {
    userId,
    enabled: false,
    platforms: ['instagram'],
    autoPublish: false,
    maxPostsPerDay: 2,
    repurposeThreshold: 3,
    quietHoursStart: 2,  // 2 AM UTC
    quietHoursEnd: 7,    // 7 AM UTC
    defaultTone: 'professional but approachable',
    contentMix: {
      educational: 30,
      entertaining: 20,
      inspirational: 20,
      promotional: 20,
      behindTheScenes: 10,
    },
    products: [],
  }
}

/**
 * Save autopilot config.
 */
export async function saveAutopilotConfig(config: AutopilotConfig): Promise<void> {
  const supabase = getSupabase()

  await supabase
    .from('autopilot_configs')
    .upsert({
      user_id: config.userId,
      enabled: config.enabled,
      platforms: config.platforms,
      brand_id: config.brandId || null,
      auto_publish: config.autoPublish,
      max_posts_per_day: config.maxPostsPerDay,
      repurpose_threshold: config.repurposeThreshold,
      quiet_hours_start: config.quietHoursStart,
      quiet_hours_end: config.quietHoursEnd,
      default_tone: config.defaultTone,
      content_mix: config.contentMix,
      products: config.products,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
}

/**
 * Log an autopilot run for audit/debugging.
 */
async function logAutopilotRun(userId: string, result: AutopilotRunResult): Promise<void> {
  const supabase = getSupabase()

  await supabase
    .from('autopilot_runs')
    .insert({
      user_id: userId,
      timestamp: result.timestamp,
      posts_created: result.postsCreated,
      posts_scheduled: result.postsScheduled,
      repurposed: result.repurposed,
      skipped: result.skipped,
      errors: result.errors,
      insights: result.insights,
      actions: result.actions,
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAutopilotConfig(row: any): AutopilotConfig {
  return {
    userId: row.user_id,
    enabled: row.enabled,
    platforms: row.platforms || ['instagram'],
    brandId: row.brand_id || undefined,
    autoPublish: row.auto_publish ?? false,
    maxPostsPerDay: row.max_posts_per_day ?? 2,
    repurposeThreshold: row.repurpose_threshold ?? 3,
    quietHoursStart: row.quiet_hours_start ?? 2,
    quietHoursEnd: row.quiet_hours_end ?? 7,
    defaultTone: row.default_tone || 'professional but approachable',
    contentMix: row.content_mix || {
      educational: 30,
      entertaining: 20,
      inspirational: 20,
      promotional: 20,
      behindTheScenes: 10,
    },
    products: row.products || [],
  }
}
