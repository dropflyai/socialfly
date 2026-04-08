import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getAvailableVideoModels } from '@/lib/engine/video-router'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// POST /api/creator/chat — conversational AI creator for videos and images
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
  const { data: brand } = await serviceClient
    .from('brand_profiles')
    .select('name, voice_tone, voice_description, target_audience, content_pillars')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (brand) {
    brandContext = `User's brand: ${brand.name}. Tone: ${brand.voice_tone}. Audience: ${brand.target_audience || 'general'}. Pillars: ${(brand.content_pillars || []).join(', ')}.`
  }

  // Load available media for context
  const { data: userMedia } = await serviceClient
    .from('brand_assets')
    .select('id, title, file_url, asset_type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const mediaLibraryInfo = userMedia?.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? `User has ${userMedia.length} media files in their library including: ${userMedia.slice(0, 5).map((m: any) => `"${m.title || 'untitled'}" (${m.asset_type})`).join(', ')}.`
    : 'User has no media uploaded yet.'

  const videoModels = getAvailableVideoModels()
  const modelInfo = videoModels.map(m => `- ${m.name}: ${m.description} Best for: ${m.bestFor}. Cost: ${m.cost}. Speed: ${m.speed}`).join('\n')

  const systemPrompt = `You are the SocialFly AI Creator — a friendly, expert assistant that helps users create stunning videos and images for social media.

${brandContext}
${mediaLibraryInfo}
${mediaContext ? `User is working with: ${mediaContext.type} "${mediaContext.name || 'uploaded file'}" (${mediaContext.url})` : ''}

AVAILABLE VIDEO MODELS:
${modelInfo}

YOUR ROLE:
1. Help users describe what they want in simple terms — they don't need to know technical prompts
2. Ask smart questions to understand their vision (what, who, mood, platform, purpose)
3. When you have enough info, generate a READY prompt by outputting a JSON action block
4. Let them refine with natural language ("make it warmer", "add more energy", "try vertical")
5. Help them repurpose existing media — turn images into videos, remix old content

RULES:
- Be conversational, not robotic. Use short messages.
- Don't overwhelm — ask 1-2 questions at a time, not 5
- When the user gives enough detail, propose a specific creative direction
- Always show what you'd create before generating (let them approve or adjust)
- If they upload or reference media, suggest ways to use it (image-to-video, edit, remix)
- Pick the best video model automatically based on what they describe, but let them override
- For social media, consider the platform (vertical for Reels/TikTok, square for feed, landscape for YouTube)

PROMPT ENGINEERING FOR VIDEO:
When writing video prompts, follow these rules:
- Be highly descriptive: describe the scene, camera angle, lighting, mood, movement
- Always include: "high quality, cinematic, no text overlays, no watermarks"
- Describe camera movement: "slow pan", "dolly zoom", "tracking shot", "static wide shot"
- Describe the subject's actions: "person walking confidently", not just "person"
- Include lighting: "golden hour lighting", "soft studio light", "dramatic shadows"
- NEVER include non-English text or random text in prompts
- Default to 10 seconds duration and 16:9 aspect ratio unless user specifies otherwise
- For Instagram Reels/TikTok, use 9:16 vertical

MODEL SELECTION:
- Use "kling" as default — best balance of quality and cost
- Use "seedance" for premium cinematic content
- Use "auto" to let the router decide
- Only use "fast" (LTX) if user asks for a quick draft

GENERATING CONTENT:
When ready to generate, include a JSON block in your response like this:
\`\`\`json
{"action": "generate_video", "prompt": "detailed cinematic prompt here, high quality, no text overlays, smooth camera movement", "model": "kling", "imageUrl": null, "aspectRatio": "16:9", "duration": "10"}
\`\`\`
or for images:
\`\`\`json
{"action": "generate_image", "prompt": "detailed image prompt, professional, high quality", "aspectRatio": "1:1"}
\`\`\`
or to suggest using their media:
\`\`\`json
{"action": "use_media", "mediaId": "id-here", "suggestion": "Turn this into a 10-second cinematic video"}
\`\`\`

Only include the JSON block when you have enough info and the user is ready. Otherwise just chat.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response' }, { status: 500 })
    }

    const text = textBlock.text

    // Extract any action JSON from the response
    let action = null
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      try {
        action = JSON.parse(jsonMatch[1])
      } catch { /* not valid json, that's fine */ }
    }

    // Clean text — remove the JSON block for display
    const displayText = text.replace(/```json\s*[\s\S]*?\s*```/g, '').trim()

    return NextResponse.json({
      message: displayText,
      action,
      // Include media suggestions if relevant
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
