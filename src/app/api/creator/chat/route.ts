import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getAvailableVideoModels } from '@/lib/engine/video-router'
import {
  buildFullPrompt,
  getAspectRatioForPlatform,
  recommendModel,
  refineBrief,
  extractStyleFromReference,
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

  const { messages, mediaContext, brandId } = await request.json() as {
    messages: ChatMessage[]
    mediaContext?: { type: 'image' | 'video'; url: string; name?: string }
    brandId?: string
  }

  if (!messages?.length) {
    return NextResponse.json({ error: 'Messages required' }, { status: 400 })
  }

  // Load ALL brand profiles
  const serviceClient = createServiceClient()
  const { data: allBrands } = await serviceClient
    .from('brand_profiles')
    .select('id, name, voice_tone, voice_description, target_audience, content_pillars')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brands = (allBrands || []) as any[]
  let brandContext = ''
  let brandName = ''

  if (brandId) {
    // User explicitly selected a brand
    const selected = brands.find(b => b.id === brandId)
    if (selected) {
      brandName = selected.name
      brandContext = `ACTIVE BRAND: ${selected.name}. Tone: ${selected.voice_tone}. Audience: ${selected.target_audience || 'general'}. Pillars: ${(selected.content_pillars || []).join(', ')}.`
    }
  } else if (brands.length === 1) {
    // Only one brand — use it
    brandName = brands[0].name
    brandContext = `User's brand: ${brands[0].name}. Tone: ${brands[0].voice_tone}. Audience: ${brands[0].target_audience || 'general'}. Pillars: ${(brands[0].content_pillars || []).join(', ')}.`
  } else if (brands.length > 1) {
    // Multiple brands — list them so Claude can ask or detect
    brandContext = `User has ${brands.length} brand profiles:\n${brands.map((b: { name: string; voice_tone: string; target_audience: string }) => `- "${b.name}" (tone: ${b.voice_tone}, audience: ${b.target_audience || 'general'})`).join('\n')}\n\nIf the user mentions a brand name or it's clear from context which brand they're creating for, use that brand's voice and style. If ambiguous, ask which brand this content is for.`
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

BRAND HANDLING:
${brands.length > 1 ? `- The user has multiple brands. If they mention a brand name (e.g., "for SocialFly" or "VoiceFly content"), use that brand's voice.
- If they don't specify, ask: "Which brand is this for?" and list: ${brands.map(b => `"${b.name}"`).join(', ')}.
- Include the brand name in the brief so we use the right voice.
- Once they pick a brand, remember it for the rest of the conversation.` : brands.length === 1 ? `- User has one brand: "${brands[0].name}". Use its voice and style automatically.` : '- No brand profiles set up yet. Create content with a general professional tone.'}

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
    "subject": "what's in the shot — be specific and descriptive",
    "action": "what's happening over time (for video)",
    "mood": "emotional tone (warm, energetic, calm, dramatic, playful, etc.)",
    "style": "visual style (cinematic, minimal, retro, neon, documentary, etc.)",
    "cameraAngle": "close-up | wide | overhead | eye-level | medium | extreme-close-up",
    "cameraMovement": "pan | zoom-in | zoom-out | dolly | tracking | static | orbit | crane",
    "cameraSpeed": "slow | medium | fast",
    "lighting": "specific lighting description (golden hour, soft studio, dramatic shadows, neon glow, etc.)",
    "colorPalette": "warm | cool | muted | vibrant | natural | monochrome",
    "background": "what's behind the subject",
    "platform": "instagram | tiktok | youtube | facebook | linkedin",
    "duration": 10,
    "purpose": "reel | ad | story | post | product-showcase | brand-story",
    "avoid": ["things user doesn't want", "like text or certain colors"],
    "styleReference": "if user referenced a style, describe it here",
    "brandName": "which brand this content is for (use exact name from the brand list)"
  },
  "description": "A 1-sentence human-readable description of what we'll create"
}
\`\`\`

REFINEMENT — when user says "make it warmer" or "change the camera":
Output a new brief with ONLY the changed fields plus "refinement": true:
\`\`\`json
{
  "ready": true,
  "refinement": true,
  "previousBrief": {copy of the last brief you sent},
  "brief": {only the fields that changed},
  "description": "Updated description"
}
\`\`\`

STYLE REFERENCES — when user says "make it look like X":
Include a "styleReference" field describing the visual style they're referencing.

THINGS TO AVOID — when user says "no text" or "don't include X":
Add those to the "avoid" array in the brief.

Only include "ready": true when you have AT LEAST: subject, mood, and platform.
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

          // Resolve brand from brief
          const briefBrandName = parsed.brief.brandName
          let resolvedBrandName = brandName
          if (briefBrandName && brands.length > 1) {
            // Find the brand Claude picked from the conversation
            const matched = brands.find((b: { name: string }) =>
              b.name.toLowerCase() === briefBrandName.toLowerCase() ||
              b.name.toLowerCase().includes(briefBrandName.toLowerCase()) ||
              briefBrandName.toLowerCase().includes(b.name.toLowerCase())
            )
            if (matched) {
              resolvedBrandName = matched.name
            }
          }

          let brief: CreativeBrief = {
            ...parsed.brief,
            brandName: resolvedBrandName || undefined,
            referenceImageUrl: mediaContext?.url || undefined,
          }

          // Handle style reference — extract style from description
          if (parsed.brief.styleReference) {
            const styleExtracted = extractStyleFromReference(parsed.brief.styleReference)
            brief = refineBrief(brief, styleExtracted)
          }

          // Handle iterative refinement — if there's a previous brief, merge
          if (parsed.refinement && parsed.previousBrief) {
            brief = refineBrief(parsed.previousBrief as CreativeBrief, brief)
          }

          // Auto-determine aspect ratio from platform if not set
          if (!brief.aspectRatio && brief.platform) {
            brief.aspectRatio = getAspectRatioForPlatform(brief.platform)
          }

          // Build the full optimized prompt (includes negative prompt, model selection)
          const fullPrompt = buildFullPrompt(brief)

          action = {
            action: brief.type === 'image' ? 'generate_image' : 'generate_video',
            prompt: fullPrompt.prompt,
            negativePrompt: fullPrompt.negativePrompt,
            model: fullPrompt.model,
            imageUrl: brief.referenceImageUrl || null,
            aspectRatio: fullPrompt.aspectRatio,
            duration: String(fullPrompt.duration),
            brief, // Pass the full brief so the frontend can show it and we can refine later
            description: parsed.description,
            cacheKey: fullPrompt.cacheKey,
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
      brands: brands.map(b => ({ id: b.id, name: b.name })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
