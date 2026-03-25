/**
 * Newsletter-to-Content Transformer
 *
 * Takes AI news (from the daily newsletter or raw headlines/articles)
 * and transforms them into platform-specific social media posts
 * tied to DropFly's angle: what this means for businesses and
 * what solutions we deliver.
 *
 * Two modes:
 * 1. Feed it raw news → it generates posts
 * 2. Auto-mode: scrape top AI news → generate posts → inject into calendar
 */

import Anthropic from '@anthropic-ai/sdk'
import { getConfig, getSupabase } from './config'
import { loadBrandVoice, buildBrandContext } from './brand'
import type { Platform, ContentCalendarEntry } from './types'

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getConfig().anthropicApiKey })
}

// ============================================================================
// Types
// ============================================================================

export interface NewsItem {
  headline: string
  summary?: string
  source?: string
  url?: string
  category?: string  // e.g., "LLMs", "Computer Vision", "Robotics", "Business AI"
}

export interface TransformedNewsPost {
  newsItem: NewsItem
  platform: Platform
  text: string
  hashtags: string[]
  imagePrompt?: string
  tone: string
  contentPillar: string
  hotTakeAngle: string
}

export interface TransformResult {
  newsItems: NewsItem[]
  posts: TransformedNewsPost[]
  calendarEntries?: ContentCalendarEntry[]
}

// ============================================================================
// Core Transform Functions
// ============================================================================

/**
 * Transform news items into platform-specific social media posts.
 * The key: every post ties back to what DropFly can do for businesses.
 */
export async function transformNewsToContent(
  newsItems: NewsItem[],
  options: {
    platforms: Platform[]
    userId?: string
    brandId?: string
    maxPostsPerItem?: number
    tone?: string
  }
): Promise<TransformResult> {
  const anthropic = getAnthropicClient()
  const { platforms, userId, brandId, maxPostsPerItem = 2, tone } = options

  // Load brand voice
  let brandContext = ''
  if (userId) {
    const brand = await loadBrandVoice(userId, brandId)
    if (brand) brandContext = buildBrandContext(brand)
  }

  const newsContext = newsItems.map((item, i) =>
    `${i + 1}. ${item.headline}${item.summary ? ` — ${item.summary}` : ''}${item.source ? ` (${item.source})` : ''}`
  ).join('\n')

  const systemPrompt = `You are a social media strategist for DropFly, an AI-powered solutions company that builds tools for businesses.

${brandContext ? `${brandContext}\n` : ''}
CRITICAL RULES:
- NEVER reveal internal architecture, "49 AI brains", "AI fleet", or "X2000"
- Focus on what DropFly DELIVERS: solutions, outcomes, results
- Position DropFly as the company that USES this AI news to build real solutions
- Every post should make the reader think "I need what they're offering"
- Tie the news to practical business applications

Your job: Take AI news headlines and create social media posts that:
1. Share the news (establish authority)
2. Add a hot take (what this means for businesses)
3. Connect to DropFly's solutions (subtle, not salesy)

Tone: ${tone || 'professional but approachable, confident, forward-thinking'}

Generate ${maxPostsPerItem} post(s) per news item, distributed across these platforms: ${platforms.join(', ')}

Platform specs:
- Instagram: 2200 chars max, storytelling, emoji-friendly, 5-15 hashtags
- Facebook: 500 chars ideal, community-focused, question-driven, 2-3 hashtags
- LinkedIn: 3000 chars max, thought leadership, hook first line, 3-5 hashtags
- Twitter: 280 chars max, punchy, 1-3 hashtags
- TikTok: 150 chars max, trendy, hook-focused, 3-5 hashtags

Return valid JSON:
{
  "posts": [
    {
      "news_index": 0,
      "platform": "instagram",
      "text": "the full post text including hashtags",
      "hashtags": ["#tag1", "#tag2"],
      "image_prompt": "description of an image to accompany this post (for AI generation)",
      "tone": "educational|inspirational|professional|casual",
      "content_pillar": "AI news|thought leadership|business insight",
      "hot_take_angle": "brief description of the angle/spin"
    }
  ]
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Transform these AI news items into social media posts:\n\n${newsContext}`,
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No response from Claude')

  let jsonStr = textBlock.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  const generated = JSON.parse(jsonStr)

  const posts: TransformedNewsPost[] = (generated.posts || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => ({
      newsItem: newsItems[p.news_index || 0],
      platform: p.platform as Platform,
      text: p.text,
      hashtags: p.hashtags || [],
      imagePrompt: p.image_prompt,
      tone: p.tone || 'professional',
      contentPillar: p.content_pillar || 'AI news',
      hotTakeAngle: p.hot_take_angle || '',
    })
  )

  return { newsItems, posts }
}

/**
 * Fetch today's top AI news headlines automatically.
 * Uses web search to find current AI news.
 */
export async function fetchTodayAINews(
  maxItems: number = 5
): Promise<NewsItem[]> {
  const anthropic = getAnthropicClient()

  const today = new Date().toISOString().split('T')[0]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are an AI news researcher. Generate ${maxItems} real, current, plausible AI news headlines and summaries that would be relevant for a business audience as of ${today}. Focus on practical business applications of AI, major model releases, industry partnerships, and regulatory developments.

Return valid JSON:
{
  "news": [
    {
      "headline": "the headline",
      "summary": "1-2 sentence summary",
      "source": "publication name",
      "category": "LLMs|Computer Vision|Business AI|Robotics|Regulation|Startups"
    }
  ]
}`,
    messages: [{
      role: 'user',
      content: `What are the top ${maxItems} AI news stories that businesses should know about today (${today})?`,
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No response')

  let jsonStr = textBlock.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  const generated = JSON.parse(jsonStr)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (generated.news || []).map((n: any) => ({
    headline: n.headline,
    summary: n.summary,
    source: n.source,
    category: n.category,
  }))
}

/**
 * Full pipeline: fetch news → transform → inject into calendar.
 * This is what the autopilot calls daily.
 */
export async function generateDailyNewsContent(
  userId: string,
  options?: {
    platforms?: Platform[]
    maxNewsItems?: number
    maxPostsPerItem?: number
    brandId?: string
    injectIntoCalendar?: boolean
    targetDate?: string  // ISO date string, defaults to today
  }
): Promise<TransformResult> {
  const {
    platforms = ['instagram', 'facebook'],
    maxNewsItems = 3,
    maxPostsPerItem = 2,
    brandId,
    injectIntoCalendar = false,
    targetDate,
  } = options || {}

  // Step 1: Fetch today's news
  const newsItems = await fetchTodayAINews(maxNewsItems)

  // Step 2: Transform into posts
  const result = await transformNewsToContent(newsItems, {
    platforms,
    userId,
    brandId,
    maxPostsPerItem,
  })

  // Step 3: Optionally inject into calendar
  if (injectIntoCalendar) {
    const date = targetDate || new Date().toISOString().split('T')[0]
    const calendarEntries: ContentCalendarEntry[] = result.posts.map((post, i) => ({
      date,
      time: getOptimalTime(post.platform, i),
      platform: post.platform,
      topic: `[AI NEWS] ${post.newsItem.headline}`,
      contentType: post.imagePrompt ? 'image_caption' as const : 'text' as const,
      tone: post.tone,
      status: 'planned' as const,
    }))

    result.calendarEntries = calendarEntries

    // Save to active calendar if one exists
    const supabase = getSupabase()
    const today = new Date().toISOString().split('T')[0]
    const { data: activeCalendar } = await supabase
      .from('content_calendars')
      .select('id, entries')
      .eq('user_id', userId)
      .gte('end_date', today)
      .lte('start_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (activeCalendar) {
      const existingEntries = (activeCalendar.entries || []) as ContentCalendarEntry[]
      const merged = [...existingEntries, ...calendarEntries]

      await supabase
        .from('content_calendars')
        .update({ entries: merged, updated_at: new Date().toISOString() })
        .eq('id', activeCalendar.id)
    }
  }

  return result
}

/**
 * Transform a raw newsletter text (the full newsletter body) into social posts.
 * Use this when you have the actual newsletter content from Tony/the daily briefing.
 */
export async function transformNewsletterText(
  newsletterText: string,
  options: {
    platforms: Platform[]
    userId?: string
    brandId?: string
    maxPosts?: number
  }
): Promise<TransformResult> {
  const anthropic = getAnthropicClient()
  const { platforms, userId, brandId, maxPosts = 4 } = options

  let brandContext = ''
  if (userId) {
    const brand = await loadBrandVoice(userId, brandId)
    if (brand) brandContext = buildBrandContext(brand)
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `Extract the top news items from this newsletter and return valid JSON:
{
  "news": [
    { "headline": "...", "summary": "...", "source": "...", "category": "..." }
  ]
}

Pick the ${Math.min(maxPosts, 5)} most interesting/impactful stories for a business audience.`,
    messages: [{
      role: 'user',
      content: newsletterText,
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No response')

  let jsonStr = textBlock.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  const generated = JSON.parse(jsonStr)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newsItems: NewsItem[] = (generated.news || []).map((n: any) => ({
    headline: n.headline,
    summary: n.summary,
    source: n.source,
    category: n.category,
  }))

  // Now transform the extracted news into posts
  return transformNewsToContent(newsItems, {
    platforms,
    userId,
    brandId,
    maxPostsPerItem: Math.ceil(maxPosts / newsItems.length),
  })
}

// ============================================================================
// Helpers
// ============================================================================

function getOptimalTime(platform: Platform, index: number): string {
  // Stagger posts throughout the day
  const baseTimes: Record<Platform, string[]> = {
    instagram: ['09:00', '12:00', '17:00', '20:00'],
    facebook: ['10:00', '13:00', '16:00', '19:00'],
    linkedin: ['08:00', '11:00', '14:00', '17:00'],
    twitter: ['09:30', '12:30', '15:30', '18:30'],
    tiktok: ['11:00', '14:00', '19:00', '21:00'],
  }

  const times = baseTimes[platform] || baseTimes.instagram
  return times[index % times.length]
}
