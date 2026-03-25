/**
 * Content & Image Generation Engine
 *
 * Standalone content and image generation - no HTTP dependencies.
 */

import Anthropic from '@anthropic-ai/sdk'
import { fal } from '@fal-ai/client'
import { getConfig, getSupabase } from './config'
import { loadBrandVoice, buildBrandContext } from './brand'
import type {
  BrandVoice,
  GenerateContentOptions,
  GeneratedContent,
  GenerateImageOptions,
  GeneratedImage,
  Platform,
} from './types'

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getConfig().anthropicApiKey })
}

const PLATFORM_SPECS: Record<string, string> = {
  twitter: 'Twitter/X: Max 280 chars. Punchy, concise. Use 1-3 hashtags max. No markdown.',
  instagram: 'Instagram: Max 2200 chars. Storytelling, emoji-friendly. Use 5-15 relevant hashtags at the end. Line breaks for readability.',
  tiktok: 'TikTok: Max 150 chars for caption. Trendy, hook-focused, Gen-Z friendly. Use 3-5 hashtags.',
  linkedin: 'LinkedIn: Max 3000 chars. Professional, thought leadership. Use 3-5 hashtags. Hook in the first line. Line breaks every 1-2 sentences.',
  facebook: 'Facebook: Max 500 chars ideal (63,206 limit). Community-focused, shareable, question-driven. Use 2-3 hashtags. Encourage comments.',
}

const CONTENT_TYPE_INSTRUCTIONS: Record<string, string> = {
  text: 'Generate a social media post/caption.',
  image_caption: 'Generate a caption to accompany an image post. Keep it engaging and complement the visual.',
  video_script: 'Generate a short video script with hook, body, and call-to-action.',
  thread: 'Generate a thread (numbered series of connected posts).',
}

/**
 * Generate platform-specific content with AI.
 */
export async function generateContent(
  options: GenerateContentOptions & { userId?: string }
): Promise<GeneratedContent> {
  const {
    topic,
    platforms,
    contentType = 'text',
    brandId,
    userId,
    tone,
    includeHashtags = true,
  } = options

  const anthropic = getAnthropicClient()

  // Load brand voice if available
  let brandContext = ''
  if (userId && brandId) {
    const brand = await loadBrandVoice(userId, brandId)
    if (brand) brandContext = buildBrandContext(brand)
  } else if (userId) {
    // Try loading default brand
    const brand = await loadBrandVoice(userId)
    if (brand) brandContext = buildBrandContext(brand)
  }

  const platformInstructions = platforms
    .map((p) => PLATFORM_SPECS[p] || `${p}: General social media post`)
    .join('\n')

  const systemPrompt = `You are an expert social media content creator.

${brandContext ? `${brandContext}\n` : ''}
Content Type: ${CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS.text}
Tone: ${tone || 'professional but approachable'}
${!includeHashtags ? 'Do NOT include hashtags.' : ''}

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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: topic }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  let jsonStr = textBlock.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  const generated = JSON.parse(jsonStr)
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens

  // Save to DB if we have a userId
  let contentId: string | undefined
  if (userId) {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('content_items')
      .insert({
        user_id: userId,
        brand_id: brandId || null,
        content_type: contentType === 'thread' ? 'text' : contentType === 'video_script' ? 'video' : 'text',
        title: topic.slice(0, 100),
        body: Object.values(generated.variants as Record<string, { text: string }>)[0]?.text || '',
        hashtags: Object.values(generated.variants as Record<string, { hashtags: string[] }>)[0]?.hashtags || [],
        generated_by: 'claude',
        generation_prompt: topic,
        tokens_used: tokensUsed,
        platform_variants: generated.variants,
      })
      .select('id')
      .single()

    contentId = data?.id
  }

  return {
    id: contentId,
    variants: generated.variants,
    contentPillar: generated.content_pillar,
    engagementHooks: generated.engagement_hooks,
    tokensUsed,
  }
}

/**
 * Enhance a simple image prompt into a detailed, high-quality prompt for FAL.ai.
 */
export async function enhanceImagePrompt(
  simplePrompt: string,
  context?: { platform?: Platform; brand?: BrandVoice; contentTopic?: string }
): Promise<string> {
  const anthropic = getAnthropicClient()

  const systemPrompt = `You are an expert at writing prompts for AI image generation (Flux/Stable Diffusion).

Given a simple description, create a detailed, high-quality image generation prompt.

Rules:
- Output ONLY the enhanced prompt, nothing else
- Be specific about composition, lighting, style, colors
- Include quality modifiers: "high quality", "professional", "sharp focus"
- For social media, prefer vibrant, eye-catching visuals
- Keep it under 200 words
- Do NOT include text/words in the image (AI models render text poorly)
- Make it photorealistic unless the user requests illustration/artwork
${context?.platform === 'instagram' ? '- Optimize for Instagram: vibrant, clean, scroll-stopping' : ''}
${context?.brand ? `- Brand style: ${context.brand.tone}, ${context.brand.industry || 'modern'}` : ''}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: context?.contentTopic
        ? `Create an image for a social media post about: ${context.contentTopic}\n\nUser's image idea: ${simplePrompt}`
        : simplePrompt,
    }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textBlock.text.trim()
}

/**
 * Generate an image with FAL.ai Flux.
 * Optionally enhances the prompt with AI first.
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GeneratedImage> {
  const config = getConfig()
  fal.config({ credentials: config.falApiKey })

  const { prompt, aspectRatio = '1:1', enhancePrompt = true } = options

  // Enhance the prompt if requested
  const finalPrompt = enhancePrompt
    ? await enhanceImagePrompt(prompt)
    : prompt

  const imageSize = aspectRatio === '4:5' ? { width: 1080, height: 1350 }
    : aspectRatio === '9:16' ? { width: 1080, height: 1920 }
    : aspectRatio === '16:9' ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1080 }

  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt: finalPrompt,
      image_size: imageSize,
      num_images: 1,
    },
  })

  const images = (result.data as { images?: { url: string }[] }).images
  if (!images?.length) {
    throw new Error('No image generated')
  }

  return {
    url: images[0].url,
    prompt,
    enhancedPrompt: enhancePrompt ? finalPrompt : undefined,
  }
}
