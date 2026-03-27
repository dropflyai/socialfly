import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { deductCredits } from '@/lib/credits'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/caption — generate captions for user-provided media
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateCheck = checkRateLimit(`${user.id}:caption`, RATE_LIMITS.aiGenerate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before generating more captions.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  const creditResult = await deductCredits(user.id, 'caption')
  if (!creditResult.success) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.', creditsRemaining: creditResult.creditsRemaining },
      { status: 402 }
    )
  }

  const { context, platforms, tone, includeCta, ctaText } = await request.json()

  if (!context || !platforms?.length) {
    return NextResponse.json({ error: 'Context and platforms are required' }, { status: 400 })
  }

  try {
    const platformList = platforms.join(', ')
    const toneInstruction = tone ? `Tone: ${tone}.` : 'Tone: professional but approachable.'
    const ctaInstruction = includeCta !== false
      ? `Include a call-to-action${ctaText ? `: "${ctaText}"` : ' relevant to the content'}.`
      : 'No call-to-action needed.'

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are a social media expert. Write platform-specific captions for the following content.

The user has their own image/video and needs captions for: ${platformList}

Context about the media: ${context}

${toneInstruction}
${ctaInstruction}

For each platform, provide:
- A caption optimized for that platform's audience and character limits
- Relevant hashtags (3-8 per platform)
- An engagement hook suggestion

Respond in this exact JSON format:
{
  "captions": {
    "${platforms[0]}": {
      "text": "caption text here",
      "hashtags": ["#tag1", "#tag2"],
      "engagement_hook": "suggestion"
    }
  },
  "content_pillar": "educational|entertaining|promotional|inspirational|behind_the_scenes"
}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      captions: parsed.captions,
      contentPillar: parsed.content_pillar,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Caption generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
