/**
 * Smart Image Router
 *
 * Routes image generation requests to the best provider based on:
 * - What the request needs (text overlay, editing, high-res, artistic style)
 * - Provider capabilities and strengths
 * - Performance history
 *
 * Providers:
 * - FAL.ai (Flux) — Best for artistic/stylized images, fast, reliable
 * - Nano Banana (Google Gemini) — Best for text-in-images, editing, 4K, character consistency
 *
 * The router scores each provider per request and picks the winner.
 */

import { fal } from '@fal-ai/client'
import { GoogleGenAI } from '@google/genai'
import { getConfig } from './config'
import type { GeneratedImage, GenerateImageOptions, ImageProvider, ImageProviderScore } from './types'

// ============================================================================
// Provider Capability Matrix
// ============================================================================

interface ProviderCapabilities {
  textInImage: number      // 0-10: Can it render text in images?
  artisticStyle: number    // 0-10: How good at creative/artistic styles?
  photoRealism: number     // 0-10: How photorealistic?
  maxResolution: number    // Max dimension in pixels
  imageEditing: boolean    // Can it edit existing images?
  characterConsistency: boolean  // Can it maintain character across images?
  speed: number            // 0-10: How fast?
  costEfficiency: number   // 0-10: How cheap?
}

const PROVIDER_CAPABILITIES: Record<'fal' | 'nanobanana', ProviderCapabilities> = {
  fal: {
    textInImage: 2,          // Flux is weak at text rendering
    artisticStyle: 9,        // Excellent for creative/artistic images
    photoRealism: 8,         // Good photorealism
    maxResolution: 1920,     // 1080-1920px
    imageEditing: false,     // No editing support
    characterConsistency: false,
    speed: 9,                // Very fast
    costEfficiency: 6,       // Pay per image
  },
  nanobanana: {
    textInImage: 9,          // Excellent text rendering
    artisticStyle: 7,        // Good but not as stylized as Flux
    photoRealism: 9,         // Excellent photorealism
    maxResolution: 3840,     // Up to 4K
    imageEditing: true,      // Full natural language editing
    characterConsistency: true, // Up to 5 characters, 14 objects
    speed: 7,                // Good but slightly slower than Flux
    costEfficiency: 9,       // Free tier available
  },
}

// ============================================================================
// Smart Router
// ============================================================================

interface RouteRequest {
  prompt: string
  aspectRatio?: string
  needsTextOverlay?: boolean    // Does the image need text rendered in it?
  needsEditing?: boolean        // Are we editing an existing image?
  needsHighRes?: boolean        // Need 4K output?
  needsConsistency?: boolean    // Need character/object consistency?
  preferredProvider?: ImageProvider
  existingImageUrl?: string     // For editing mode
  referenceImages?: string[]    // For style transfer
}

/**
 * Score each provider for a given request and pick the best one.
 */
export function scoreProviders(request: RouteRequest): ImageProviderScore[] {
  const config = getConfig()
  const hasGemini = !!config.geminiApiKey
  const hasFal = !!config.falApiKey

  const scores: ImageProviderScore[] = []

  // Score FAL.ai
  if (hasFal) {
    let score = 50 // Base score
    const reasons: string[] = []

    if (request.needsTextOverlay) {
      score -= 30
      reasons.push('FAL weak at text-in-image (-30)')
    } else {
      score += 10
      reasons.push('No text needed, FAL handles well (+10)')
    }

    if (request.needsEditing) {
      score -= 50
      reasons.push('FAL cannot edit existing images (-50)')
    }

    if (request.needsHighRes) {
      score -= 10
      reasons.push('FAL max 1920px (-10)')
    }

    if (request.needsConsistency) {
      score -= 20
      reasons.push('FAL has no character consistency (-20)')
    }

    // Check prompt for artistic/style keywords
    const artisticKeywords = ['artistic', 'illustration', 'painting', 'watercolor', 'abstract', 'surreal', 'fantasy', 'anime', 'cartoon', 'sketch', 'digital art']
    if (artisticKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      score += 20
      reasons.push('Artistic style detected, FAL excels (+20)')
    }

    // Check for text-in-image requests
    const textKeywords = ['text saying', 'with text', 'with the words', 'caption', 'headline', 'banner', 'sign that says', 'logo text', 'quote']
    if (textKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      score -= 20
      reasons.push('Text rendering detected, FAL weak (-20)')
    }

    scores.push({ provider: 'fal', score: Math.max(0, score), reasons })
  }

  // Score Nano Banana
  if (hasGemini) {
    let score = 50 // Base score
    const reasons: string[] = []

    if (request.needsTextOverlay) {
      score += 30
      reasons.push('Nano Banana excels at text-in-image (+30)')
    }

    if (request.needsEditing) {
      score += 40
      reasons.push('Nano Banana supports image editing (+40)')
    }

    if (request.needsHighRes) {
      score += 15
      reasons.push('Nano Banana supports up to 4K (+15)')
    }

    if (request.needsConsistency) {
      score += 25
      reasons.push('Nano Banana character consistency (+25)')
    }

    // Check for text-in-image
    const textKeywords = ['text saying', 'with text', 'with the words', 'caption', 'headline', 'banner', 'sign that says', 'logo text', 'quote']
    if (textKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      score += 25
      reasons.push('Text rendering detected, Nano Banana excels (+25)')
    }

    // Check for product/marketing content (Nano Banana has web grounding)
    const marketingKeywords = ['product', 'brand', 'marketing', 'social media', 'professional', 'business', 'mockup']
    if (marketingKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      score += 10
      reasons.push('Marketing content, Nano Banana web-grounded (+10)')
    }

    // Artistic styles slightly favor FAL
    const artisticKeywords = ['artistic', 'illustration', 'painting', 'watercolor', 'abstract', 'surreal', 'fantasy', 'anime', 'cartoon']
    if (artisticKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      score -= 10
      reasons.push('Artistic style, slightly less stylized than FAL (-10)')
    }

    if (request.existingImageUrl || request.referenceImages?.length) {
      score += 20
      reasons.push('Reference/edit images provided, Nano Banana handles (+20)')
    }

    scores.push({ provider: 'nanobanana', score: Math.max(0, score), reasons })
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score)

  return scores
}

/**
 * Pick the best provider for a request.
 */
export function pickProvider(request: RouteRequest): 'fal' | 'nanobanana' {
  const config = getConfig()

  // If user explicitly chose a provider
  if (request.preferredProvider && request.preferredProvider !== 'auto') {
    return request.preferredProvider as 'fal' | 'nanobanana'
  }

  // If config has a non-auto default
  if (config.defaultImageProvider && config.defaultImageProvider !== 'auto') {
    return config.defaultImageProvider as 'fal' | 'nanobanana'
  }

  // Smart routing
  const scores = scoreProviders(request)

  if (scores.length === 0) {
    return 'fal' // Fallback
  }

  return scores[0].provider as 'fal' | 'nanobanana'
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * Generate image via FAL.ai Flux.
 */
async function generateWithFal(
  prompt: string,
  aspectRatio: string = '1:1'
): Promise<GeneratedImage> {
  const config = getConfig()
  fal.config({ credentials: config.falApiKey })

  const imageSize = aspectRatio === '4:5' ? { width: 1080, height: 1350 }
    : aspectRatio === '9:16' ? { width: 1080, height: 1920 }
    : aspectRatio === '16:9' ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1080 }

  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: imageSize,
      num_images: 1,
    },
  })

  const images = (result.data as { images?: { url: string }[] }).images
  if (!images?.length) throw new Error('No image generated by FAL.ai')

  return {
    url: images[0].url,
    prompt,
    enhancedPrompt: prompt,
  }
}

/**
 * Generate image via Nano Banana (Google Gemini).
 */
async function generateWithNanoBanana(
  prompt: string,
  aspectRatio: string = '1:1'
): Promise<GeneratedImage> {
  const config = getConfig()
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured')

  const genai = new GoogleGenAI({ apiKey: config.geminiApiKey })

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash-preview-image-generation',
    contents: [{
      role: 'user',
      parts: [{ text: prompt }],
    }],
    config: {
      responseModalities: ['image', 'text'],
    },
  })

  // Extract image from response
  const parts = response.candidates?.[0]?.content?.parts
  if (!parts) throw new Error('No response from Nano Banana')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart?.inlineData) throw new Error('No image generated by Nano Banana')

  // Convert base64 to a data URL (for immediate use) or upload to storage
  const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`

  return {
    url: dataUrl,
    prompt,
    enhancedPrompt: prompt,
  }
}

/**
 * Edit an existing image via Nano Banana.
 */
async function editWithNanoBanana(
  imageUrl: string,
  editPrompt: string
): Promise<GeneratedImage> {
  const config = getConfig()
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured')

  const genai = new GoogleGenAI({ apiKey: config.geminiApiKey })

  // Download the image
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) throw new Error('Failed to download image for editing')
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
  const mimeType = imageRes.headers.get('content-type') || 'image/jpeg'

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash-preview-image-generation',
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType,
            data: imageBuffer.toString('base64'),
          },
        },
        { text: editPrompt },
      ],
    }],
    config: {
      responseModalities: ['image', 'text'],
    },
  })

  const parts = response.candidates?.[0]?.content?.parts
  if (!parts) throw new Error('No response from Nano Banana edit')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart?.inlineData) throw new Error('No edited image returned')

  const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`

  return {
    url: dataUrl,
    prompt: editPrompt,
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Smart image generation — routes to the best provider automatically.
 */
export async function smartGenerateImage(
  options: GenerateImageOptions & {
    needsTextOverlay?: boolean
    needsHighRes?: boolean
    needsConsistency?: boolean
    preferredProvider?: ImageProvider
  }
): Promise<GeneratedImage & { provider: string; routingScore?: ImageProviderScore[] }> {
  const { prompt, aspectRatio = '1:1' } = options

  const routeRequest: RouteRequest = {
    prompt,
    aspectRatio,
    needsTextOverlay: options.needsTextOverlay,
    needsHighRes: options.needsHighRes,
    needsConsistency: options.needsConsistency,
    preferredProvider: options.preferredProvider,
  }

  const scores = scoreProviders(routeRequest)
  const provider = pickProvider(routeRequest)

  let result: GeneratedImage

  if (provider === 'nanobanana') {
    result = await generateWithNanoBanana(prompt, aspectRatio)
  } else {
    result = await generateWithFal(prompt, aspectRatio)
  }

  return {
    ...result,
    provider,
    routingScore: scores,
  }
}

/**
 * Edit an existing image (Nano Banana only — FAL can't edit).
 */
export async function smartEditImage(
  imageUrl: string,
  editPrompt: string
): Promise<GeneratedImage & { provider: string }> {
  const result = await editWithNanoBanana(imageUrl, editPrompt)
  return { ...result, provider: 'nanobanana' }
}

/**
 * Get routing explanation for a request (for debugging/transparency).
 */
export function explainRouting(prompt: string, options?: {
  needsTextOverlay?: boolean
  needsEditing?: boolean
  needsHighRes?: boolean
  needsConsistency?: boolean
}): { winner: string; scores: ImageProviderScore[] } {
  const scores = scoreProviders({ prompt, ...options })
  return {
    winner: scores[0]?.provider || 'fal',
    scores,
  }
}
