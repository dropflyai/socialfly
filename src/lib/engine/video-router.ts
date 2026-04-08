/**
 * Smart Video Router
 *
 * Routes video generation requests to the best provider based on:
 * - Quality requirements (cinematic vs. fast draft)
 * - Input type (text-to-video vs. image-to-video)
 * - Content style (marketing, artistic, product demo)
 * - Cost optimization
 *
 * Providers:
 * - Seedance 2.0 (via FAL.ai) — #1 ranked, best for cinematic/marketing videos
 * - Minimax Video (via FAL.ai) — High quality, good for product showcases
 * - LTX Video (via FAL.ai) — Fast & cheap, good for drafts/testing
 *
 * The router scores each provider per request and picks the winner.
 */

import { fal } from '@fal-ai/client'
import { getConfig } from './config'
import type { GenerateVideoOptions, GeneratedVideo, VideoProvider, VideoProviderScore } from './types'

// ============================================================================
// Provider Capability Matrix
// ============================================================================

interface VideoProviderCapabilities {
  cinematicQuality: number    // 0-10: Cinematic, film-like output
  motionRealism: number       // 0-10: How natural is the motion?
  textFollowing: number       // 0-10: How well does it follow the prompt?
  imageToVideo: boolean       // Supports image-to-video?
  maxDuration: number         // Max duration in seconds
  speed: number               // 0-10: Generation speed
  costEfficiency: number      // 0-10: How affordable?
  characterConsistency: number // 0-10: Consistent characters across frames
  audioSync: boolean          // Supports audio-driven generation?
}

const PROVIDER_CAPABILITIES: Record<'seedance' | 'kling' | 'minimax' | 'ltx', VideoProviderCapabilities> = {
  seedance: {
    cinematicQuality: 10,      // #1 on video leaderboard
    motionRealism: 10,         // Best-in-class motion
    textFollowing: 9,          // Excellent prompt adherence
    imageToVideo: true,        // Full image-to-video support
    maxDuration: 10,           // Up to 10 seconds
    speed: 5,                  // ~2-4 minutes per video
    costEfficiency: 4,         // Premium pricing (~$0.80/video)
    characterConsistency: 9,   // Excellent subject consistency
    audioSync: true,           // Audio-driven generation
  },
  kling: {
    cinematicQuality: 8,       // Very high quality, close to Seedance
    motionRealism: 9,          // Excellent realistic human motion
    textFollowing: 8,          // Good prompt adherence
    imageToVideo: true,        // Full image-to-video support
    maxDuration: 10,           // Up to 10 seconds
    speed: 6,                  // ~1-2 minutes per video
    costEfficiency: 7,         // Mid-range (~$0.10-0.40/video)
    characterConsistency: 8,   // Strong subject consistency
    audioSync: false,
  },
  minimax: {
    cinematicQuality: 7,
    motionRealism: 7,
    textFollowing: 7,
    imageToVideo: true,
    maxDuration: 10,
    speed: 6,
    costEfficiency: 5,         // ~$0.50/video
    characterConsistency: 6,
    audioSync: false,
  },
  ltx: {
    cinematicQuality: 4,
    motionRealism: 5,
    textFollowing: 6,
    imageToVideo: true,
    maxDuration: 10,
    speed: 9,                  // Very fast
    costEfficiency: 9,         // ~$0.02/video
    characterConsistency: 4,
    audioSync: false,
  },
}

// FAL.ai model IDs
const MODEL_IDS = {
  seedance: {
    textToVideo: 'fal-ai/seedance-video-01-lora',
    imageToVideo: 'fal-ai/seedance-video-01-lora',
  },
  kling: {
    textToVideo: 'fal-ai/kling-video/v1/standard/text-to-video',
    imageToVideo: 'fal-ai/kling-video/v1/standard/image-to-video',
  },
  minimax: {
    textToVideo: 'fal-ai/minimax-video',
    imageToVideo: 'fal-ai/minimax-video/image-to-video',
  },
  ltx: {
    textToVideo: 'fal-ai/ltx-video',
    imageToVideo: 'fal-ai/ltx-video/image-to-video',
  },
}

const MODEL_LABELS: Record<string, string> = {
  seedance: 'Seedance 2.0 (Cinematic, ~$0.80)',
  kling: 'Kling (Realistic, ~$0.20)',
  minimax: 'Minimax Video (Quality, ~$0.50)',
  ltx: 'LTX Video (Fast, ~$0.02)',
}

// ============================================================================
// Smart Router
// ============================================================================

interface VideoRouteRequest {
  prompt: string
  imageUrl?: string
  needsCinematic?: boolean
  needsFast?: boolean
  needsCheap?: boolean
  needsCharacterConsistency?: boolean
  preferredProvider?: VideoProvider
}

/**
 * Score each video provider for a given request.
 */
export function scoreVideoProviders(request: VideoRouteRequest): VideoProviderScore[] {
  const config = getConfig()
  const hasFal = !!config.falApiKey

  if (!hasFal) return []

  const scores: VideoProviderScore[] = []

  // Score each provider
  for (const [name, caps] of Object.entries(PROVIDER_CAPABILITIES)) {
    let score = 50
    const reasons: string[] = []

    // Cinematic quality needs
    if (request.needsCinematic) {
      const boost = (caps.cinematicQuality - 5) * 5
      score += boost
      reasons.push(`Cinematic quality: ${caps.cinematicQuality}/10 (${boost > 0 ? '+' : ''}${boost})`)
    }

    // Speed preference
    if (request.needsFast) {
      const boost = (caps.speed - 5) * 6
      score += boost
      reasons.push(`Speed: ${caps.speed}/10 (${boost > 0 ? '+' : ''}${boost})`)
    }

    // Cost preference
    if (request.needsCheap) {
      const boost = (caps.costEfficiency - 5) * 5
      score += boost
      reasons.push(`Cost: ${caps.costEfficiency}/10 (${boost > 0 ? '+' : ''}${boost})`)
    }

    // Character consistency
    if (request.needsCharacterConsistency) {
      const boost = (caps.characterConsistency - 5) * 4
      score += boost
      reasons.push(`Character consistency: ${caps.characterConsistency}/10 (${boost > 0 ? '+' : ''}${boost})`)
    }

    // Image-to-video: all support it, but Seedance does it best
    if (request.imageUrl) {
      if (name === 'seedance') {
        score += 15
        reasons.push('Seedance excels at image-to-video (+15)')
      }
    }

    // Prompt analysis — detect quality-demanding keywords
    const cinematicKeywords = ['cinematic', 'film', 'movie', 'dramatic', 'epic', 'professional', 'commercial', 'ad', 'marketing', 'brand']
    if (cinematicKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      if (name === 'seedance') {
        score += 20
        reasons.push('Cinematic/marketing keywords detected, Seedance best choice (+20)')
      } else if (name === 'kling') {
        score += 12
        reasons.push('Cinematic keywords, Kling strong option (+12)')
      } else if (name === 'minimax') {
        score += 5
        reasons.push('Cinematic keywords, Minimax decent (+5)')
      }
    }

    // Realistic human/people keywords — Kling excels here
    const realisticKeywords = ['person', 'people', 'human', 'face', 'portrait', 'talking', 'walking', 'dancing', 'lifestyle', 'model', 'customer', 'employee']
    if (realisticKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      if (name === 'kling') {
        score += 18
        reasons.push('Realistic human motion detected, Kling excels (+18)')
      } else if (name === 'seedance') {
        score += 10
        reasons.push('Human content, Seedance also strong (+10)')
      }
    }

    // Fast/draft keywords
    const draftKeywords = ['test', 'draft', 'quick', 'rough', 'preview', 'mockup']
    if (draftKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      if (name === 'ltx') {
        score += 20
        reasons.push('Draft/test keywords detected, LTX fast & cheap (+20)')
      }
    }

    // Product/demo keywords
    const productKeywords = ['product', 'demo', 'showcase', 'feature', 'walkthrough', 'tutorial']
    if (productKeywords.some(kw => request.prompt.toLowerCase().includes(kw))) {
      if (name === 'seedance') {
        score += 10
        reasons.push('Product showcase keywords, Seedance handles well (+10)')
      } else if (name === 'kling') {
        score += 10
        reasons.push('Product demo, Kling realistic and cost-effective (+10)')
      } else if (name === 'minimax') {
        score += 8
        reasons.push('Product keywords, Minimax good option (+8)')
      }
    }

    // Image-to-video: Kling is also great at this
    if (request.imageUrl && name === 'kling') {
      score += 10
      reasons.push('Kling strong at image-to-video (+10)')
    }

    scores.push({ provider: name as VideoProvider, score: Math.max(0, score), reasons })
  }

  scores.sort((a, b) => b.score - a.score)
  return scores
}

/**
 * Pick the best video provider for a request.
 */
export function pickVideoProvider(request: VideoRouteRequest): 'seedance' | 'kling' | 'minimax' | 'ltx' {
  const config = getConfig()

  // If user explicitly chose a provider
  if (request.preferredProvider && request.preferredProvider !== 'auto') {
    return request.preferredProvider as 'seedance' | 'kling' | 'minimax' | 'ltx'
  }

  // If config has a non-auto default
  if (config.defaultVideoProvider && config.defaultVideoProvider !== 'auto') {
    return config.defaultVideoProvider as 'seedance' | 'kling' | 'minimax' | 'ltx'
  }

  // Smart routing
  const scores = scoreVideoProviders(request)

  if (scores.length === 0) {
    return 'kling' // Default to best value (quality + cost)
  }

  return scores[0].provider as 'seedance' | 'kling' | 'minimax' | 'ltx'
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * Generate video via Seedance 2.0 (FAL.ai hosted).
 */
async function generateWithSeedance(
  prompt: string,
  imageUrl?: string,
): Promise<GeneratedVideo> {
  const config = getConfig()
  fal.config({ credentials: config.falApiKey })

  const enhancedPrompt = enhanceVideoPrompt(prompt)
  const modelId = imageUrl
    ? MODEL_IDS.seedance.imageToVideo
    : MODEL_IDS.seedance.textToVideo

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: Record<string, any> = {
    prompt: enhancedPrompt,
    num_inference_steps: 30,
    guidance_scale: 5,
    seed: Math.floor(Math.random() * 1000000),
  }

  if (imageUrl) {
    input.image_url = imageUrl
  }

  const result = await fal.subscribe(modelId, { input })

  const videoUrl = extractVideoUrl(result.data)
  if (!videoUrl) {
    console.error('Seedance response shape:', JSON.stringify(result.data).slice(0, 500))
    throw new Error('No video URL in Seedance response')
  }

  return {
    url: videoUrl,
    prompt,
    provider: 'seedance',
    model: MODEL_LABELS.seedance,
  }
}

/**
 * Generate video via Minimax (FAL.ai hosted).
 */
async function generateWithMinimax(
  prompt: string,
  imageUrl?: string,
): Promise<GeneratedVideo> {
  const config = getConfig()
  fal.config({ credentials: config.falApiKey })

  const enhancedPrompt = enhanceVideoPrompt(prompt)
  const modelId = imageUrl
    ? MODEL_IDS.minimax.imageToVideo
    : MODEL_IDS.minimax.textToVideo

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: Record<string, any> = {
    prompt: enhancedPrompt,
    prompt_optimizer: true,
  }

  if (imageUrl) {
    input.image_url = imageUrl
  }

  const result = await fal.subscribe(modelId, { input })

  const videoUrl = extractVideoUrl(result.data)
  if (!videoUrl) {
    console.error('Minimax response shape:', JSON.stringify(result.data).slice(0, 500))
    throw new Error('No video URL in Minimax response')
  }

  return {
    url: videoUrl,
    prompt,
    provider: 'minimax',
    model: MODEL_LABELS.minimax,
  }
}

/**
 * Generate video via Kling (FAL.ai hosted).
 */
async function generateWithKling(
  prompt: string,
  imageUrl?: string,
): Promise<GeneratedVideo> {
  const config = getConfig()
  fal.config({ credentials: config.falApiKey })

  const enhancedPrompt = enhanceVideoPrompt(prompt)
  const modelId = imageUrl
    ? MODEL_IDS.kling.imageToVideo
    : MODEL_IDS.kling.textToVideo

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: Record<string, any> = {
    prompt: enhancedPrompt,
    duration: '10',
    aspect_ratio: '16:9',
  }

  if (imageUrl) {
    input.image_url = imageUrl
  }

  const result = await fal.subscribe(modelId, { input })

  const videoUrl = extractVideoUrl(result.data)
  if (!videoUrl) {
    console.error('Kling response shape:', JSON.stringify(result.data).slice(0, 500))
    throw new Error('No video URL in Kling response')
  }

  return {
    url: videoUrl,
    prompt,
    provider: 'kling',
    model: MODEL_LABELS.kling,
  }
}

/**
 * Generate video via LTX Video (FAL.ai hosted).
 */
async function generateWithLtx(
  prompt: string,
  imageUrl?: string,
): Promise<GeneratedVideo> {
  const config = getConfig()
  fal.config({ credentials: config.falApiKey })

  const enhancedPrompt = enhanceVideoPrompt(prompt)
  const modelId = imageUrl
    ? MODEL_IDS.ltx.imageToVideo
    : MODEL_IDS.ltx.textToVideo

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: Record<string, any> = {
    prompt: enhancedPrompt,
    num_inference_steps: 40,
    guidance_scale: 4,
  }

  if (imageUrl) {
    input.image_url = imageUrl
  }

  const result = await fal.subscribe(modelId, { input })

  const videoUrl = extractVideoUrl(result.data)
  if (!videoUrl) {
    console.error('LTX response shape:', JSON.stringify(result.data).slice(0, 500))
    throw new Error('No video URL in LTX response')
  }

  return {
    url: videoUrl,
    prompt,
    provider: 'ltx',
    model: MODEL_LABELS.ltx,
  }
}

/**
 * Extract video URL from various FAL.ai response shapes.
 */
function extractVideoUrl(data: unknown): string | undefined {
  const d = data as Record<string, unknown>

  // Shape: { video: { url } }
  if (d.video && typeof d.video === 'object' && 'url' in (d.video as Record<string, unknown>)) {
    return (d.video as { url: string }).url
  }

  // Shape: { url }
  if (d.url && typeof d.url === 'string') {
    return d.url
  }

  // Shape: { videos: [{ url }] }
  if (Array.isArray(d.videos) && d.videos.length > 0 && d.videos[0]?.url) {
    return d.videos[0].url
  }

  // Shape: { output: { url } }
  if (d.output && typeof d.output === 'object' && 'url' in (d.output as Record<string, unknown>)) {
    return (d.output as { url: string }).url
  }

  return undefined
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Enhance a video prompt to get better results from AI models.
 */
function enhanceVideoPrompt(prompt: string): string {
  // Don't re-enhance if already detailed
  if (prompt.length > 200) return prompt

  const enhancements: string[] = []

  // Add quality keywords if not present
  const hasQuality = ['cinematic', '4k', 'hd', 'high quality', 'professional', 'detailed'].some(kw => prompt.toLowerCase().includes(kw))
  if (!hasQuality) enhancements.push('high quality, cinematic')

  // Add "no text" to avoid random text overlays
  const hasTextInstructions = ['text', 'words', 'caption', 'subtitle', 'title'].some(kw => prompt.toLowerCase().includes(kw))
  if (!hasTextInstructions) enhancements.push('no text overlays, no watermarks')

  // Add smooth motion
  const hasMotion = ['smooth', 'steady', 'fluid', 'slow motion'].some(kw => prompt.toLowerCase().includes(kw))
  if (!hasMotion) enhancements.push('smooth camera movement')

  if (enhancements.length > 0) {
    return `${prompt}. ${enhancements.join(', ')}.`
  }
  return prompt
}

/**
 * Smart video generation — routes to the best provider automatically.
 */
export async function smartGenerateVideo(
  options: GenerateVideoOptions
): Promise<GeneratedVideo & { routingScore?: VideoProviderScore[] }> {
  const { prompt: rawPrompt, imageUrl, preferredProvider } = options
  const prompt = enhanceVideoPrompt(rawPrompt)

  const routeRequest: VideoRouteRequest = {
    prompt,
    imageUrl,
    preferredProvider,
  }

  const scores = scoreVideoProviders(routeRequest)
  const provider = pickVideoProvider(routeRequest)

  let result: GeneratedVideo

  switch (provider) {
    case 'seedance':
      result = await generateWithSeedance(prompt, imageUrl)
      break
    case 'kling':
      result = await generateWithKling(prompt, imageUrl)
      break
    case 'minimax':
      result = await generateWithMinimax(prompt, imageUrl)
      break
    case 'ltx':
      result = await generateWithLtx(prompt, imageUrl)
      break
    default:
      result = await generateWithKling(prompt, imageUrl)
  }

  return {
    ...result,
    routingScore: scores,
  }
}

/**
 * Generate video with a specific provider (no routing).
 */
export async function generateVideoWithProvider(
  provider: 'seedance' | 'kling' | 'minimax' | 'ltx',
  rawPrompt: string,
  imageUrl?: string,
): Promise<GeneratedVideo> {
  const prompt = enhanceVideoPrompt(rawPrompt)
  switch (provider) {
    case 'seedance':
      return generateWithSeedance(prompt, imageUrl)
    case 'kling':
      return generateWithKling(prompt, imageUrl)
    case 'minimax':
      return generateWithMinimax(prompt, imageUrl)
    case 'ltx':
      return generateWithLtx(prompt, imageUrl)
    default:
      return generateWithKling(prompt, imageUrl)
  }
}

/**
 * Get routing explanation for a request (for debugging/transparency).
 */
export function explainVideoRouting(prompt: string, options?: {
  imageUrl?: string
  needsCinematic?: boolean
  needsFast?: boolean
  needsCheap?: boolean
}): { winner: string; scores: VideoProviderScore[] } {
  const scores = scoreVideoProviders({ prompt, ...options })
  return {
    winner: scores[0]?.provider || 'seedance',
    scores,
  }
}

/**
 * Get all available video models with their details.
 */
export function getAvailableVideoModels() {
  return [
    {
      id: 'seedance',
      name: 'Seedance 2.0',
      description: '#1 ranked AI video model. Cinematic quality, best motion realism, character consistency.',
      cost: '~$0.80/video',
      speed: '2-4 minutes',
      bestFor: 'Marketing videos, product showcases, cinematic content',
      capabilities: PROVIDER_CAPABILITIES.seedance,
    },
    {
      id: 'kling',
      name: 'Kling',
      description: 'Excellent realistic human motion and image-to-video. Great balance of quality and cost.',
      cost: '~$0.20/video',
      speed: '1-2 minutes',
      bestFor: 'Realistic people, product demos, social media reels, image-to-video',
      capabilities: PROVIDER_CAPABILITIES.kling,
    },
    {
      id: 'minimax',
      name: 'Minimax Video',
      description: 'High quality video generation with good prompt adherence.',
      cost: '~$0.50/video',
      speed: '1-3 minutes',
      bestFor: 'Product demos, explainer content',
      capabilities: PROVIDER_CAPABILITIES.minimax,
    },
    {
      id: 'ltx',
      name: 'LTX Video',
      description: 'Fast and affordable video generation for drafts and testing.',
      cost: '~$0.02/video',
      speed: '10-30 seconds',
      bestFor: 'Quick drafts, testing ideas, high-volume content',
      capabilities: PROVIDER_CAPABILITIES.ltx,
    },
  ]
}
