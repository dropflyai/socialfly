/**
 * Smart Image Router
 *
 * Routes image generation requests to the best provider based on:
 * - What the request needs (text overlay, editing, high-res, artistic style)
 * - Provider capabilities and strengths
 * - Performance history
 *
 * Providers:
 * - Higgsfield — PRIMARY engine (gated on key); full media surface (U0)
 * - FAL.ai (Flux) — fallback + commodity-draft lane; fast, reliable
 *
 * The router scores each provider per request and picks the winner.
 *
 * PRUNE (rung E1, docs/01-CAPABILITY-ENGINE-RESPEC.md §1.3): the standalone
 * Stability / DALL-E / Nano-Banana image lanes were removed — Higgsfield now
 * natively covers those models (seedream/gpt_image/nano_banana_pro). Verified
 * ZERO external callers before removal. OpenAI/Gemini keys remain for TEXT only.
 */

import { fal } from '@fal-ai/client'
import { GoogleGenAI } from '@google/genai'
import { getConfig } from './config'
import { higgsfieldGenerateImage } from './providers/higgsfield'
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

// PRUNE (E1): nanobanana/dalle/stability rows removed — Higgsfield covers those
// models natively. Matrix is now PRIMARY(higgsfield) + FALLBACK(fal) only.
const PROVIDER_CAPABILITIES: Record<'higgsfield' | 'fal', ProviderCapabilities> = {
  higgsfield: {
    textInImage: 9,          // gpt_image-grade text rendering on the Higgsfield zoo
    artisticStyle: 9,        // soul_2 / seedream / flux_2 — broad stylistic range
    photoRealism: 9,         // seedream/soul photorealism
    maxResolution: 3840,     // up to 4K (seedream)
    imageEditing: true,      // flux_2 kontext editing/style-transfer
    characterConsistency: true,  // soul_2 / soul_cast identity (load-bearing for U2)
    speed: 6,                // async submit→poll
    costEfficiency: 5,       // workspace-credit metered
  },
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
  const hasFal = !!config.falApiKey

  const scores: ImageProviderScore[] = []

  // Score Higgsfield (additive — only scored when the key is configured, so when
  // HIGGSFIELD_API_KEY is absent it never enters the ranking and selection is unchanged).
  const hasHiggsfield = !!config.higgsfieldApiKey
  if (hasHiggsfield) {
    // Baseline preference bump so Higgsfield wins ties when configured as primary.
    let score = 65
    const reasons: string[] = ['Higgsfield configured, primary-engine bump (+65 base)']

    if (request.needsTextOverlay) {
      score += 20
      reasons.push('Higgsfield strong at text-in-image (+20)')
    }

    if (request.needsEditing) {
      score += 20
      reasons.push('Higgsfield supports editing via flux_2 kontext (+20)')
    }

    if (request.needsHighRes) {
      score += 10
      reasons.push('Higgsfield supports up to 4K (+10)')
    }

    if (request.needsConsistency) {
      score += 30
      reasons.push('Higgsfield soul_2/soul_cast character consistency (+30)')
    }

    scores.push({ provider: 'higgsfield', score: Math.max(0, score), reasons })
  }

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

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score)

  return scores
}

/**
 * Pick the best provider for a request.
 */
export function pickProvider(request: RouteRequest): 'higgsfield' | 'fal' {
  const config = getConfig()

  // If user explicitly chose a provider (post-prune: only higgsfield/fal selectable)
  if (request.preferredProvider && request.preferredProvider !== 'auto') {
    return request.preferredProvider as 'higgsfield' | 'fal'
  }

  // If config has a non-auto default
  if (config.defaultImageProvider && config.defaultImageProvider !== 'auto') {
    return config.defaultImageProvider as 'higgsfield' | 'fal'
  }

  // Smart routing
  const scores = scoreProviders(request)

  if (scores.length === 0) {
    return 'fal' // Fallback
  }

  return scores[0].provider as 'higgsfield' | 'fal'
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
 * Edit an existing image via Nano Banana (Gemini).
 *
 * KEPT post-prune (E1): this powers smartEditImage, which has an EXTERNAL caller
 * (src/app/api/image/edit/route.ts). The standalone nano-banana GENERATION lane
 * was pruned, but the EDIT primary stays until the Higgsfield flux_2-kontext edit
 * lane is wired (later rung). See docs/01-CAPABILITY-ENGINE-RESPEC.md §1.3 item 4.
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
  if (!imageRes.ok) throw new Error(`Failed to download image for editing: ${imageRes.status}`)
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
  let mimeType = imageRes.headers.get('content-type') || 'image/jpeg'

  // Ensure valid image mime type — storage URLs sometimes return wrong content-type
  if (!mimeType.startsWith('image/')) {
    mimeType = 'image/jpeg'
  }

  console.log(`[Image Edit] Downloading ${imageUrl.slice(0, 80)}... Size: ${imageBuffer.length} bytes, MIME: ${mimeType}`)

  if (imageBuffer.length < 100) {
    throw new Error('Downloaded image is too small — likely not a valid image file')
  }

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{
      role: 'user',
      parts: [
        { text: `Edit this image: ${editPrompt}` },
        {
          inlineData: {
            mimeType,
            data: imageBuffer.toString('base64'),
          },
        },
      ],
    }],
    config: {
      responseModalities: ['Text', 'Image'],
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

  // Post-prune (E1): only higgsfield (primary) + fal (fallback) are selectable.
  if (provider === 'higgsfield') {
    result = await higgsfieldGenerateImage(prompt, aspectRatio)
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
 * Edit an existing image. Tries Gemini first, falls back to Fal AI.
 */
export async function smartEditImage(
  imageUrl: string,
  editPrompt: string
): Promise<GeneratedImage & { provider: string }> {
  try {
    const result = await editWithNanoBanana(imageUrl, editPrompt)
    return { ...result, provider: 'gemini' }
  } catch (err) {
    console.error('Gemini edit failed, falling back to Fal AI:', err instanceof Error ? err.message : err)
  }

  // Fallback to Fal AI
  const config = getConfig()
  fal.config({ credentials: config.falApiKey || process.env.FAL_KEY })

  const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
    input: {
      image_url: imageUrl,
      prompt: `Edited version of this image: ${editPrompt}. Apply the changes while keeping the overall composition.`,
      strength: 0.85,
      num_images: 1,
    },
  })

  const images = (result.data as { images?: { url: string }[] }).images
  if (!images?.length) throw new Error('No edited image generated')

  return {
    url: images[0].url,
    prompt: editPrompt,
    enhancedPrompt: editPrompt,
    provider: 'fal',
  }
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
