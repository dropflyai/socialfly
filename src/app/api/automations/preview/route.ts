import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import { checkCredits } from '@/lib/credits'
import { checkFeatureAccess } from '@/lib/tier-gates'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/automations/preview — generate a preview of what the automation would post
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const featureCheck = await checkFeatureAccess(user.id, 'autopilot')
  if (!featureCheck.allowed) {
    return NextResponse.json({ error: featureCheck.reason }, { status: 403 })
  }

  const body = await request.json()
  const { type, config, platforms } = body

  if (!type || !platforms?.length) {
    return NextResponse.json({ error: 'Type and platforms required' }, { status: 400 })
  }

  // Check if user has enough credits (don't deduct — just preview)
  const creditCheck = await checkCredits(user.id, 'caption')
  if (!creditCheck.allowed) {
    return NextResponse.json({ error: 'Insufficient credits for preview' }, { status: 402 })
  }

  const topics = (config?.topics as string[]) || []
  const userTone = (config?.tone as string) || 'Professional'
  const contentExamples = (config?.contentExamples as string) || ''
  const userIndustry = (config?.industry as string) || ''

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
    brandContext = `Brand: ${brand.name}. Tone: ${brand.voice_tone || userTone}. Audience: ${brand.target_audience || 'general'}. Pillars: ${(brand.content_pillars || []).join(', ')}.`
  } else {
    brandContext = `Tone: ${userTone}.`
  }

  const todaysTopic = topics.length > 0
    ? topics[Math.floor(Math.random() * topics.length)]
    : ''

  let prompt: string
  switch (type) {
    case 'content_calendar':
      prompt = `You are a social media manager creating today's post.
${brandContext}
${todaysTopic ? `Today's topic/theme: ${todaysTopic}` : 'Choose an engaging topic that fits the brand.'}
${contentExamples ? `\nStyle reference:\n${contentExamples}` : ''}
The tone should be ${userTone.toLowerCase()}.
Create an engaging, original post. Include relevant hashtags.`
      break

    case 'ai_news':
      prompt = `You are a social media manager posting about industry news.
${brandContext}
Industry: ${userIndustry || todaysTopic || 'technology'}
${contentExamples ? `\nStyle reference:\n${contentExamples}` : ''}
The tone should be ${userTone.toLowerCase()}.
Generate a post about a current trend or insight. Include hashtags.`
      break

    case 'product_ad': {
      const product = (config?.product as string) || ''
      const productDesc = (config?.productDescription as string) || ''
      const pains = (config?.painPoints as string[]) || ['saving time']
      const todaysPain = pains[Math.floor(Math.random() * pains.length)]
      prompt = `You are a social media marketer.
${brandContext}
Product: ${product}. What it does: ${productDesc}.
Pain point: ${todaysPain}
${contentExamples ? `\nStyle reference:\n${contentExamples}` : ''}
The tone should be ${userTone.toLowerCase()}.
Create a pain-point driven post. Be helpful, not salesy. Include hashtags.`
      break
    }

    default:
      prompt = `You are a social media manager.
${brandContext}
${todaysTopic ? `Topic: ${todaysTopic}` : ''}
The tone should be ${userTone.toLowerCase()}.
Create an engaging post. Include hashtags.`
  }

  const platformSpecs: Record<string, string> = {
    instagram: 'Instagram: storytelling, emoji-friendly, 5-15 hashtags at end',
    facebook: 'Facebook: community-focused, shareable, 2-3 hashtags',
    linkedin: 'LinkedIn: professional, thought leadership, 3-5 hashtags',
    tiktok: 'TikTok: max 150 chars, trendy, 3-5 hashtags',
  }

  const platformInstructions = platforms
    .map((p: string) => platformSpecs[p] || `${p}: general social media post`)
    .join('\n')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `${prompt}

Generate platform-specific versions for: ${platforms.join(', ')}

Platform specs:
${platformInstructions}

Return valid JSON:
{
  "text": "the main post text",
  "imagePrompt": "description of an ideal image for this post",
  "variants": {
    "${platforms[0]}": { "text": "platform text", "hashtags": ["#tag1"] }
  }
}`,
      }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let generated: { text: string; imagePrompt?: string; variants?: Record<string, { text: string; hashtags?: string[] }> }
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON')
      generated = JSON.parse(jsonMatch[0])
    } catch {
      generated = { text: textBlock.text.slice(0, 2000) }
    }

    return NextResponse.json({
      preview: {
        text: generated.variants?.[platforms[0]]?.text || generated.text,
        imagePrompt: generated.imagePrompt,
        variants: generated.variants,
        platforms,
        tone: userTone,
        topic: todaysTopic,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Preview generation failed' },
      { status: 500 }
    )
  }
}
