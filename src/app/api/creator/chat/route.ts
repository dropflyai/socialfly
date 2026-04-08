import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getAvailableVideoModels } from '@/lib/engine/video-router'
import {
  buildPromptFromBrief,
  getAspectRatioForPlatform,
  recommendModel,
  type CreativeBrief,
} from '@/lib/engine/prompt-engineer'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// POST /api/creator/chat — two-stage conversational AI creator
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateCheck = checkRateLimit(`${user.id}:creator-chat`, RATE_LIMITS.aiGenerate)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { messages, mediaContext } = await request.json() as {
    messages: ChatMessage[]
    mediaContext?: { type: 'image' | 'video'; url: string; name?: string }
  }

  if (!messages?.length) {
    return NextResponse.json({ error: 'Messages required' }, { status: 400 })
  }

  // Load brand context
  const serviceClient = createServiceClient()
  let brandContext = ''
  let brandName = ''
  const { data: brand } = await serviceClient
    .from('brand_profiles')
    .select('name, voice_tone, voice_description, target_audience, content_pillars')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (brand) {
    brandName = brand.name
    brandContext = `User's brand: ${brand.name}. Tone: ${brand.voice_tone}. Audience: ${brand.target_audience || 'general'}. Pillars: ${(brand.content_pillars || []).join(', ')}.`
  }

  // Load available media
  const { data: userMedia } = await serviceClient
    .from('brand_assets')
    .select('id, title, file_url, asset_type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mediaLibraryInfo = userMedia?.length
    ? `User has ${userMedia.length} media files. Recent: ${userMedia.slice(0, 3).map((m: any) => `"${m.title || 'untitled'}" (${m.asset_type})`).join(', ')}.`
    : ''

  const videoModels = getAvailableVideoModels()

  // ============================================================
  // STAGE 1: Creative Director — conversation + brief extraction
  // ============================================================

  const systemPrompt = `You are the SocialFly AI Creative Director. You help users create stunning videos and images for social media through natural conversation.

${brandContext}
${mediaLibraryInfo}
${mediaContext ? `User is working with: ${mediaContext.type} "${mediaContext.name || 'uploaded file'}" (${mediaContext.url})` : ''}

YOUR JOB:
1. Chat naturally — understand what they want to create
2. Ask smart questions (1-2 at a time, not 5):
   - What should it show? (subject)
   - What mood/vibe? (mood)
   - What platform? (affects aspect ratio)
   - Any specific style? (cinematic, minimal, etc.)
3. When you have enough info, output a CREATIVE BRIEF as JSON

CONVERSATION RULES:
- Be friendly and brief — 1-3 sentences per message
- Don't overwhelm with options
- Make suggestions based on their brand and what works on social media
- If they mention their media library, suggest using it
- If they're vague, make a creative suggestion and ask if they like it

WHEN READY TO GENERATE:
Output a creative brief JSON block. This is NOT the final prompt — our prompt engineer will optimize it for the specific model. Just capture the creative direction.

\`\`\`json
{
  "ready": true,
  "brief": {
    "type": "video",
    "subject": "what's in the shot",
    "action": "what's happening (for video)",
    "mood": "emotional tone",
    "style": "visual style",
    "cameraAngle": "close-up | wide | overhead | eye-level | medium",
    "cameraMovement": "pan | zoom-in | zoom-out | dolly | tracking | static | orbit",
    "cameraSpeed": "slow | medium | fast",
    "lighting": "description of lighting",
    "colorPalette": "warm | cool | muted | vibrant | natural",
    "background": "what's behind subject",
    "platform": "instagram | tiktok | youtube | facebook | linkedin",
    "duration": 10,
    "purpose": "reel | ad | story | post | product-showcase | brand-story"
  },
  "description": "A 1-sentence human-readable description of what we'll create"
}
\`\`\`

Only include "ready": true when you have AT LEAST: subject, mood, and platform.
If the user says to adjust something, output a new brief with the changes.
For images, set type to "image" and omit camera/duration fields.

AVAILABLE MODELS (for your reference, don't show to user):
${videoModels.map(m => `- ${m.name}: ${m.bestFor}`).join('\n')}

DO NOT write the actual generation prompt. Just capture creative direction. Our prompt engine handles the technical part.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response' }, { status: 500 })
    }

    const text = textBlock.text

    // Extract creative brief JSON if present
    let action = null
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])

        if (parsed.ready && parsed.brief) {
          // ============================================================
          // STAGE 2: Prompt Engineer — build model-specific prompt
          // ============================================================

          const brief: CreativeBrief = {
            ...parsed.brief,
            brandName: brandName || undefined,
            referenceImageUrl: mediaContext?.url || undefined,
          }

          // Auto-determine aspect ratio from platform if not set
          if (!brief.aspectRatio && brief.platform) {
            brief.aspectRatio = getAspectRatioForPlatform(brief.platform)
          }

          // Pick the best model for this brief
          const model = recommendModel(brief)

          // Build the optimized prompt for this specific model
          const optimizedPrompt = buildPromptFromBrief(brief, model)

          action = {
            action: brief.type === 'image' ? 'generate_image' : 'generate_video',
            prompt: optimizedPrompt,
            model,
            imageUrl: brief.referenceImageUrl || null,
            aspectRatio: brief.aspectRatio || (brief.type === 'video' ? '16:9' : '1:1'),
            duration: String(brief.duration || 10),
            brief, // Pass the full brief for transparency
            description: parsed.description,
          }
        }
      } catch { /* not valid json, that's fine */ }
    }

    // Clean text for display
    const displayText = text.replace(/```json\s*[\s\S]*?\s*```/g, '').trim()

    return NextResponse.json({
      message: displayText,
      action,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      availableMedia: mediaContext ? undefined : userMedia?.slice(0, 5).map((m: any) => ({
        id: m.id,
        name: m.title || 'Untitled',
        url: m.file_url,
        type: m.asset_type,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
