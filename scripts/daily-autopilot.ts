#!/usr/bin/env npx tsx
/**
 * Daily Autopilot — Local Cron Script
 *
 * Runs every morning at 6 AM PST on the Mac Mini.
 * Generates today's content (AI news + product ads), creates images,
 * and publishes to Instagram on a staggered schedule throughout the day.
 *
 * Uses the full SocialFly engine with all MCPs available.
 *
 * Crontab entry:
 * 0 6 * * * cd /Users/dropfly/Projects/socialfly && npx tsx scripts/daily-autopilot.ts >> logs/autopilot.log 2>&1
 */

import { initEngine, generateDailyNewsContent, generateContent, generateContentCalendar } from '../src/lib/engine/index.js'
import { getSupabase } from '../src/lib/engine/config.js'
import { GoogleGenAI } from '@google/genai'

// Load env from .env.local
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

const INSTAGRAM_TOKEN = process.env.INSTAGRAM_PAGE_TOKEN || ''
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || ''
const USER_ID = '40ef93a5-1212-4878-b2b6-7285a39fc40c'
const GRAPH_API = 'https://graph.facebook.com/v21.0'

// Stagger config
const MIN_GAP_MS = 45 * 60 * 1000  // 45 minutes between posts
const MAX_POSTS = 5  // max posts per day

initEngine()

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`)

// ============================================================================
// Instagram Publishing
// ============================================================================

async function publishToInstagram(imageUrl: string, caption: string): Promise<string | null> {
  try {
    // Step 1: Create media container
    const containerRes = await fetch(`${GRAPH_API}/${INSTAGRAM_ACCOUNT_ID}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: INSTAGRAM_TOKEN }),
    })
    const containerData = await containerRes.json() as { id?: string; error?: { message: string } }
    if (!containerData.id) { log('Container failed: ' + JSON.stringify(containerData)); return null }

    // Step 2: Wait for ready
    for (let i = 0; i < 30; i++) {
      const statusRes = await fetch(`${GRAPH_API}/${containerData.id}?fields=status_code&access_token=${INSTAGRAM_TOKEN}`)
      const statusData = await statusRes.json() as { status_code?: string }
      if (statusData.status_code === 'FINISHED') break
      if (statusData.status_code === 'ERROR') { log('Media processing error'); return null }
      await new Promise(r => setTimeout(r, 2000))
    }

    // Step 3: Publish
    const publishRes = await fetch(`${GRAPH_API}/${INSTAGRAM_ACCOUNT_ID}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerData.id, access_token: INSTAGRAM_TOKEN }),
    })
    const publishData = await publishRes.json() as { id?: string }
    return publishData.id || null
  } catch (e) {
    log('Publish error: ' + (e instanceof Error ? e.message : 'unknown'))
    return null
  }
}

// ============================================================================
// Image Generation
// ============================================================================

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseModalities: ['image', 'text'] },
    })

    const parts = response.candidates?.[0]?.content?.parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imagePart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
    if (!imagePart?.inlineData) return null

    // Upload to Supabase Storage
    const buffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const filename = `autopilot/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    const supabase = getSupabase()
    await supabase.storage.from('assets').upload(filename, buffer, { contentType: 'image/png', upsert: true })
    const { data } = supabase.storage.from('assets').getPublicUrl(filename)
    return data.publicUrl
  } catch (e) {
    log('Image gen error: ' + (e instanceof Error ? e.message : 'unknown'))
    return null
  }
}

// ============================================================================
// Main Autopilot
// ============================================================================

async function main() {
  log('=== DAILY AUTOPILOT START ===')

  // Step 1: Generate AI news content
  log('Generating AI news content...')
  const newsResult = await generateDailyNewsContent(USER_ID, {
    platforms: ['instagram'],
    maxNewsItems: 2,
    maxPostsPerItem: 1,
  })
  log(`Generated ${newsResult.posts.length} news posts`)

  // Step 2: Generate VoiceFly ad content
  log('Generating VoiceFly ad content...')
  const painPoints = [
    'VoiceFly ad: Missed calls cost small businesses $500+ each. AI phone employee answers 24/7. Founders Deal: $25/month.',
    'VoiceFly ad: After-hours calls going to voicemail. Customers call competitors. VoiceFly answers when you cant. $25/month.',
    'VoiceFly ad: Receptionist costs $3500/month. VoiceFly AI costs $25. Same job, 140x less. Founders Deal.',
    'VoiceFly ad: Bilingual AI answers in English and Spanish. Serve every customer. $25/month.',
    'VoiceFly ad: No-shows cost $600/day. AI reminders reduce no-shows 60%. $25/month.',
  ]
  const dayOfWeek = new Date().getDay()
  const todaysPainPoint = painPoints[dayOfWeek % painPoints.length]

  const voiceflyContent = await generateContent({
    topic: todaysPainPoint,
    platforms: ['instagram'],
    contentType: 'image_caption',
    tone: 'direct, urgent, empathetic',
    userId: USER_ID,
  })

  // Build post queue
  interface PostItem { type: string; caption: string; imagePrompt: string }
  const postQueue: PostItem[] = []

  // Add news posts (max 2)
  for (const post of newsResult.posts.slice(0, 2)) {
    postQueue.push({
      type: 'news',
      caption: post.text,
      imagePrompt: post.imagePrompt || `Professional social media graphic about: ${post.newsItem.headline}. Dark background, bold white text, modern tech aesthetic. Square 1080x1080.`,
    })
  }

  // Add VoiceFly ad (1 per day)
  const vfVariant = voiceflyContent.variants.instagram
  if (vfVariant) {
    const fullCaption = vfVariant.text + (vfVariant.hashtags?.length ? '\n\n' + vfVariant.hashtags.join(' ') : '')
    postQueue.push({
      type: 'voicefly',
      caption: fullCaption,
      imagePrompt: `Bold social media ad for VoiceFly AI phone employee. Theme: ${todaysPainPoint.slice(0, 60)}. Dark background, impactful text overlay, diverse characters. Square 1080x1080.`,
    })
  }

  log(`Post queue: ${postQueue.length} posts`)

  // Step 3: Generate images and publish with staggering
  const supabase = getSupabase()
  let postsPublished = 0

  for (let i = 0; i < Math.min(postQueue.length, MAX_POSTS); i++) {
    const post = postQueue[i]

    // Stagger: wait between posts (skip first)
    if (i > 0) {
      const waitMs = MIN_GAP_MS + Math.random() * 15 * 60 * 1000 // 45-60 min
      log(`Waiting ${Math.round(waitMs / 60000)} minutes before next post...`)
      await new Promise(r => setTimeout(r, waitMs))
    }

    log(`[${i + 1}/${postQueue.length}] Generating image for ${post.type} post...`)
    const imageUrl = await generateImage(post.imagePrompt)

    if (!imageUrl) {
      log(`Skipping post ${i + 1} — image generation failed`)
      continue
    }

    log(`Publishing to Instagram...`)
    const postId = await publishToInstagram(imageUrl, post.caption)

    if (postId) {
      postsPublished++
      log(`POSTED: ${post.type} — Instagram ID: ${postId}`)

      // Log to database
      await supabase.from('scheduled_posts').insert({
        user_id: USER_ID,
        platforms: ['instagram'],
        scheduled_for: new Date().toISOString(),
        status: 'posted',
        posted_at: new Date().toISOString(),
        platform_post_ids: { instagram: postId },
        platform_errors: {},
        custom_content: { text: post.caption.slice(0, 200), media_urls: [imageUrl], media_type: 'image' },
      })
    } else {
      log(`FAILED: ${post.type} post — publish returned null`)
    }
  }

  log(`=== DAILY AUTOPILOT COMPLETE: ${postsPublished}/${postQueue.length} posts published ===`)
}

main().catch(e => {
  log('FATAL: ' + (e instanceof Error ? e.message : 'unknown'))
  process.exit(1)
})
