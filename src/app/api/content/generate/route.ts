import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface GenerateRequest {
  prompt: string
  platforms: string[]
  contentType: 'text' | 'image_caption' | 'video_script' | 'thread'
  brandId?: string
  tone?: string
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: GenerateRequest = await request.json()
  const { prompt, platforms, contentType, brandId, tone } = body

  if (!prompt || !platforms?.length) {
    return NextResponse.json({ error: 'Missing prompt or platforms' }, { status: 400 })
  }

  // Optionally load brand voice
  let brandContext = ''
  if (brandId) {
    const serviceClient = createServiceClient()
    const { data: brand } = await serviceClient
      .from('brand_profiles')
      .select('*')
      .eq('id', brandId)
      .single()

    if (brand) {
      brandContext = `
Brand Voice:
- Name: ${brand.name}
- Tone: ${brand.voice_tone}
- Description: ${brand.voice_description || 'Not specified'}
- Target Audience: ${brand.target_audience || 'General'}
- Industry: ${brand.industry || 'Not specified'}
`
    }
  }

  const platformSpecs: Record<string, string> = {
    twitter: 'Twitter/X: Max 280 chars. Punchy, concise. Use 1-3 hashtags max. No markdown.',
    instagram: 'Instagram: Max 2200 chars. Storytelling, emoji-friendly. Use 5-15 relevant hashtags at the end. Line breaks for readability.',
    tiktok: 'TikTok: Max 150 chars for caption. Trendy, hook-focused, Gen-Z friendly. Use 3-5 hashtags.',
    linkedin: 'LinkedIn: Max 3000 chars. Professional, thought leadership. Use 3-5 hashtags.',
    facebook: 'Facebook: Max 500 chars. Community-focused, shareable. Use 2-3 hashtags.',
  }

  const platformInstructions = platforms
    .map((p) => platformSpecs[p] || `${p}: General social media post`)
    .join('\n')

  const contentTypeInstructions: Record<string, string> = {
    text: 'Generate a social media post/caption.',
    image_caption: 'Generate a caption to accompany an image post.',
    video_script: 'Generate a short video script with hook, body, and call-to-action.',
    thread: 'Generate a thread (numbered series of connected posts).',
  }

  const systemPrompt = `You are an expert social media content creator for DropFly and its products (VoiceFly, TaxFly, SocialFly).

${brandContext}

Content Type: ${contentTypeInstructions[contentType] || contentTypeInstructions.text}
Tone: ${tone || 'professional but approachable'}

Generate platform-specific versions of the content. Each version should be optimized for that platform's format and audience.

Platform Requirements:
${platformInstructions}

Return valid JSON with this structure:
{
  "variants": {
    "<platform>": {
      "text": "the post text",
      "hashtags": ["#tag1", "#tag2"],
      "suggested_media": "description of ideal accompanying media",
      "best_posting_time": "suggested time like '9am EST' or '12pm EST'"
    }
  },
  "content_pillar": "educational|entertaining|inspirational|promotional|behind-the-scenes",
  "engagement_hooks": ["question or CTA suggestion 1", "question or CTA suggestion 2"]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON from response
    let jsonStr = textBlock.text
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    const generated = JSON.parse(jsonStr)

    // Save to content_items table
    const serviceClient = createServiceClient()
    const platformVariants = generated.variants

    // Create one content_item with all variants
    const { data: contentItem, error: dbError } = await serviceClient
      .from('content_items')
      .insert({
        user_id: user.id,
        brand_id: brandId || null,
        content_type: contentType === 'thread' ? 'text' : contentType === 'video_script' ? 'video' : 'text',
        title: prompt.slice(0, 100),
        body: Object.values(platformVariants as Record<string, { text: string }>)[0]?.text || '',
        hashtags: Object.values(platformVariants as Record<string, { hashtags: string[] }>)[0]?.hashtags || [],
        generated_by: 'claude',
        generation_prompt: prompt,
        tokens_used: response.usage.input_tokens + response.usage.output_tokens,
        platform_variants: platformVariants,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Failed to save content:', dbError)
    }

    return NextResponse.json({
      success: true,
      content: {
        id: contentItem?.id,
        variants: platformVariants,
        contentPillar: generated.content_pillar,
        engagementHooks: generated.engagement_hooks,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      },
    })
  } catch (error) {
    console.error('Content generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
