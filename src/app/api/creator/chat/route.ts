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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageAssets = (userMedia || []).filter((m: any) => m.asset_type === 'image')
  const mediaLibraryInfo = userMedia?.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? `User has ${userMedia.length} media files (${imageAssets.length} images). Recent images that could be animated into videos: ${imageAssets.slice(0, 5).map((m: any) => `"${m.title || 'untitled'}"`).join(', ')}${imageAssets.length === 0 ? ' (no images yet)' : ''}.`
    : 'User has no media uploaded yet.'

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

VIDEO CREATION STRATEGY — IMPORTANT:
When a user wants a VIDEO, always start from an IMAGE:

OPTION A — User has media selected or uploaded:
- Go straight to animate. Output type: "video" with their image as the reference.
- Say: "Let's animate your image into a video! What kind of motion do you want?"

OPTION B — User has images in their media library:
- PROACTIVELY suggest: "I see you have some images in your library — want to animate one of those into a video? Or should I create a fresh image first?"
- If they pick a library image, go straight to animate (type: "video")

OPTION C — No existing images:
- Generate an AI image first (the "key frame"), let them approve, then animate
- Output type: "image" with "videoIntent": true
- Say: "Let me first create the perfect frame for your video, then we'll bring it to life."

PRIORITY ORDER: Always check for existing media first (A → B → C). Using the user's own images makes the content more authentic and personal.

When outputting the image-first brief, add "videoIntent": true so the frontend knows this image will become a video.

The ONLY time to use direct text-to-video (no image) is if the user explicitly asks for it or the scene can't be captured in a single frame (e.g., a complex motion sequence).

CONVERSATION RULES:
- Be friendly and brief — 1-3 sentences per message
- Don't overwhelm with options
- Make suggestions based on their brand and what works on social media
- If they mention their media library, suggest using it
- If they're vague, make a creative suggestion and ask if they like it

SCENE EXTRACTION:
Your job is to extract a detailed SCENE DESCRIPTION from the conversation. Think like a film director — you need to know exactly what the camera sees, what happens in the shot, how the light falls, and what the viewer feels.

KEY QUESTIONS to ask (naturally, 1-2 at a time):
- "What should be in the shot?" → subject + subjectDetails
- "What's happening?" → action + motionDirection (e.g., "pouring left to right", "walking toward camera")
- "Where is this?" → setting + timeOfDay
- "What vibe/mood?" → mood + colorGrade
- "What platform?" → platform (determines format)
- "Close-up or wide shot?" → shotSize + cameraMovement

Don't ask all of these — infer what you can. If they say "cozy coffee shop video for Instagram," you already know: setting=cafe, mood=cozy warm, platform=instagram, shotSize=close-up probably.

WHEN READY TO GENERATE:
Output a scene brief. Be SPECIFIC — "a woman" is bad, "a woman in her 30s with curly brown hair wearing a cream sweater" is good. Our prompt engine turns this into a screenplay-style prompt.

\`\`\`json
{
  "ready": true,
  "brief": {
    "type": "video",
    "subject": "SPECIFIC description of who/what is in the shot",
    "subjectDetails": "appearance, clothing, expression, texture, color",
    "action": "SPECIFIC motion — what happens over the duration, describe the arc of movement",
    "motionDirection": "toward camera | away | left to right | right to left | upward | downward",
    "setting": "SPECIFIC location (not just 'cafe' but 'a sunlit Parisian corner cafe with marble tables')",
    "timeOfDay": "dawn | morning | golden hour | midday | afternoon | sunset | blue hour | night",
    "weather": "clear | overcast | rain | fog | snow | windy",
    "shotSize": "extreme-close-up | close-up | medium-close | medium | medium-wide | wide | extreme-wide",
    "cameraMovement": "static | dolly-in | dolly-out | pan-left | pan-right | tracking | orbit | crane-up | crane-down | handheld",
    "cameraSpeed": "very-slow | slow | medium | fast",
    "cameraHeight": "ground-level | low-angle | eye-level | high-angle | overhead | bird-eye",
    "mood": "the emotion the viewer should feel",
    "style": "cinematic | documentary | commercial | indie | music-video | vlog | editorial",
    "colorGrade": "warm golden | cool blue | teal and orange | desaturated | vibrant saturated | moody dark | bright airy | vintage faded",
    "lighting": "natural sunlight | soft diffused | dramatic shadows | backlit silhouette | rim light | neon glow | studio softbox | candlelight",
    "lightDirection": "front | side | back | overhead | below",
    "lensStyle": "shallow depth of field | wide angle | telephoto compression | macro | anamorphic | fish-eye",
    "platform": "instagram | tiktok | youtube | facebook | linkedin",
    "duration": 10,
    "purpose": "reel | ad | story | post | product-showcase | brand-story",
    "avoid": ["things to exclude"],
    "styleReference": "visual style reference if mentioned",
    "brandName": "which brand"
  },
  "description": "A vivid 1-sentence description of the scene"
}
\`\`\`

REFINEMENT — when user says "make it warmer" or "change the camera":
\`\`\`json
{
  "ready": true,
  "refinement": true,
  "previousBrief": {the last brief},
  "brief": {only changed fields},
  "description": "Updated description"
}
\`\`\`

You don't need ALL fields — just the ones you can extract. But the more specific you are on subject, action, and setting, the better the video will be.

IMAGE-FIRST VIDEO FLOW:
When the user wants a video and doesn't already have an image selected, set type to "image" and add "videoIntent": true in the brief. This tells the system to generate the key frame image first, then animate it.

Example for video request:
\`\`\`json
{
  "ready": true,
  "brief": {
    "type": "image",
    "videoIntent": true,
    "subject": "steaming latte being poured...",
    ...other scene fields...
  },
  "description": "First we'll create the perfect frame, then animate it into a video"
}
\`\`\`

When the user already has an image selected (mediaContext exists), set type to "video" directly — skip image generation.

After the user approves the generated image and says to animate/proceed, output:
\`\`\`json
{
  "ready": true,
  "brief": {
    "type": "video",
    "action": "describe the motion/animation to apply",
    ...scene fields...
  },
  "description": "Animating the approved image into a cinematic video"
}
\`\`\`

AVAILABLE MODELS (for your reference, don't tell user):
${videoModels.map(m => `- ${m.name}: ${m.bestFor}`).join('\n')}

DO NOT write the generation prompt. Capture the SCENE. Our engine writes the prompt.`

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

          // Handle videoIntent — image-first video flow
          const videoIntent = !!(parsed.brief.videoIntent)
          const isImageFirst = videoIntent && brief.type === 'image'

          // For image-first flow, build an image prompt from the scene
          // For direct video, build a video prompt
          const fullPrompt = buildFullPrompt(isImageFirst ? { ...brief, type: 'image' } : brief)

          action = {
            action: brief.type === 'image' ? 'generate_image' : 'generate_video',
            prompt: fullPrompt.prompt,
            negativePrompt: fullPrompt.negativePrompt,
            model: fullPrompt.model,
            imageUrl: brief.referenceImageUrl || null,
            aspectRatio: fullPrompt.aspectRatio,
            duration: String(fullPrompt.duration),
            videoIntent, // Tell frontend this image should become a video
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
