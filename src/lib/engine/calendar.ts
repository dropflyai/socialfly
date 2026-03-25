/**
 * Content Calendar Generator
 *
 * AI-powered content calendar that plans an entire week/month of posts.
 * Considers brand voice, platform best practices, content pillars, and optimal timing.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getConfig, getSupabase } from './config'
import { loadBrandVoice, buildBrandContext } from './brand'
import type {
  Platform,
  ContentType,
  ContentCalendar,
  ContentCalendarEntry,
} from './types'

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getConfig().anthropicApiKey })
}

interface GenerateCalendarOptions {
  userId: string
  platforms: Platform[]
  startDate: string // ISO date string (YYYY-MM-DD)
  days: number // 7 for a week, 30 for a month
  postsPerDay?: number // default 1
  themes?: string[] // content themes/pillars to rotate through
  brandId?: string
  tone?: string
  includeImages?: boolean // whether to suggest image prompts
  campaignId?: string
}

/**
 * Generate an AI-powered content calendar.
 */
export async function generateContentCalendar(
  options: GenerateCalendarOptions
): Promise<ContentCalendar> {
  const {
    userId,
    platforms,
    startDate,
    days,
    postsPerDay = 1,
    themes = [],
    brandId,
    tone,
    includeImages = true,
    campaignId,
  } = options

  const anthropic = getAnthropicClient()

  // Load brand voice
  let brandContext = ''
  const brand = await loadBrandVoice(userId, brandId)
  if (brand) brandContext = buildBrandContext(brand)

  const totalPosts = days * postsPerDay

  const systemPrompt = `You are an expert social media strategist and content planner.

${brandContext ? `${brandContext}\n` : ''}
Generate a detailed content calendar with exactly ${totalPosts} posts spread across ${days} days.

Rules:
- Start date: ${startDate}
- Posts per day: ${postsPerDay}
- Platforms: ${platforms.join(', ')}
- Rotate content across platforms evenly
- Mix content types: text posts, image posts, video concepts, carousels
- Follow the 80/20 rule: 80% value (educational, entertaining, inspirational) / 20% promotional
- Suggest optimal posting times for each platform
- Each post needs a specific topic (not generic), a content type, and a tone
${themes.length > 0 ? `- Rotate through these themes: ${themes.join(', ')}` : '- Cover a variety of relevant industry themes'}
${includeImages ? '- For image posts, include a brief image_prompt describing the visual' : ''}
${tone ? `- Overall tone: ${tone}` : ''}

Return valid JSON with this structure:
{
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "platform": "instagram",
      "topic": "Specific topic for this post",
      "content_type": "text|image_caption|video_script|thread",
      "tone": "professional|casual|playful|inspirational|educational",
      "image_prompt": "Brief image description (only for image posts)"
    }
  ],
  "themes": ["theme1", "theme2"],
  "strategy_notes": "Brief notes on the overall strategy"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Create a ${days}-day content calendar for ${platforms.join(', ')} starting ${startDate}. ${themes.length > 0 ? `Focus on: ${themes.join(', ')}` : 'Cover relevant topics for the brand.'}`,
    }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  let jsonStr = textBlock.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  const generated = JSON.parse(jsonStr)

  // Map to our types
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + days - 1)

  const entries: ContentCalendarEntry[] = (generated.entries || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => ({
      date: e.date,
      time: e.time || '09:00',
      platform: e.platform as Platform,
      topic: e.topic,
      contentType: (e.content_type || 'text') as ContentType,
      tone: e.tone,
      campaignId,
      status: 'planned' as const,
    })
  )

  const calendar: ContentCalendar = {
    entries,
    startDate,
    endDate: endDate.toISOString().split('T')[0],
    platforms,
    postsPerDay,
    themes: generated.themes || themes,
  }

  // Save to database
  const supabase = getSupabase()
  const { data } = await supabase
    .from('content_calendars')
    .insert({
      user_id: userId,
      start_date: startDate,
      end_date: calendar.endDate,
      platforms,
      posts_per_day: postsPerDay,
      themes: calendar.themes,
      entries: calendar.entries,
      campaign_id: campaignId || null,
      strategy_notes: generated.strategy_notes || null,
    })
    .select('id')
    .single()

  if (data?.id) calendar.id = data.id

  return calendar
}

/**
 * Get existing content calendars for a user.
 */
export async function getContentCalendars(
  userId: string,
  options?: { limit?: number; active?: boolean }
): Promise<ContentCalendar[]> {
  const supabase = getSupabase()

  let query = supabase
    .from('content_calendars')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(options?.limit || 10)

  if (options?.active) {
    const today = new Date().toISOString().split('T')[0]
    query = query.gte('end_date', today)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to get calendars: ${error.message}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    id: row.id,
    entries: row.entries || [],
    startDate: row.start_date,
    endDate: row.end_date,
    platforms: row.platforms,
    postsPerDay: row.posts_per_day,
    themes: row.themes || [],
  }))
}

/**
 * Execute a calendar entry — generates and publishes/schedules the post.
 * This is called by the cron job or manually to bring a calendar entry to life.
 */
export async function executeCalendarEntry(
  userId: string,
  calendarId: string,
  entryIndex: number
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const supabase = getSupabase()

  const { data: calendar } = await supabase
    .from('content_calendars')
    .select('entries')
    .eq('id', calendarId)
    .single()

  if (!calendar) throw new Error('Calendar not found')

  const entries = calendar.entries as ContentCalendarEntry[]
  const entry = entries[entryIndex]
  if (!entry) throw new Error(`Entry index ${entryIndex} not found`)

  if (entry.status !== 'planned') {
    return { success: false, error: `Entry already ${entry.status}` }
  }

  try {
    // Import pipeline to avoid circular deps
    const { generateAndPublish } = await import('./pipeline')

    const scheduledFor = `${entry.date}T${entry.time}:00Z`
    const isInFuture = new Date(scheduledFor) > new Date()

    const result = await generateAndPublish({
      topic: entry.topic,
      platforms: [entry.platform],
      userId,
      includeImage: entry.contentType === 'image_caption',
      tone: entry.tone,
      scheduleFor: isInFuture ? scheduledFor : undefined,
    })

    // Mark entry as scheduled/posted
    entries[entryIndex] = { ...entry, status: isInFuture ? 'scheduled' : 'posted' }
    await supabase
      .from('content_calendars')
      .update({ entries })
      .eq('id', calendarId)

    return {
      success: result.success,
      postId: result.scheduledPost?.id || result.publishResult?.contentId,
      error: result.error,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
