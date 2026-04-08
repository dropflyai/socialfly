/**
 * Prompt Engineer — Stage 2 of the conversational creator
 *
 * Takes a structured creative brief and builds model-specific
 * optimized prompts for video and image generation.
 *
 * Features:
 * - Model-specific prompt optimization (Kling, Seedance, Minimax, LTX)
 * - Negative prompts to avoid unwanted artifacts
 * - Iterative refinement (tweak existing brief instead of restarting)
 * - Style reference analysis
 * - Prompt caching for regeneration
 */

// ============================================================================
// Creative Brief — structured output from the Creative Director
// ============================================================================

export interface CreativeBrief {
  // Core
  type: 'video' | 'image'
  subject: string
  action?: string
  mood: string
  style?: string

  // Camera (video)
  cameraAngle?: string
  cameraMovement?: string
  cameraSpeed?: string

  // Visual
  lighting?: string
  colorPalette?: string
  background?: string

  // Technical
  platform?: string
  aspectRatio?: string
  duration?: number

  // Context
  brandName?: string
  purpose?: string
  referenceImageUrl?: string

  // Negative — things to avoid
  avoid?: string[]

  // Style reference — description of a reference video/image style
  styleReference?: string
}

// ============================================================================
// Negative Prompts — things models should avoid
// ============================================================================

const UNIVERSAL_NEGATIVE = [
  'no text overlays', 'no watermarks', 'no subtitles', 'no logos',
  'no blurry frames', 'no distorted faces', 'no extra limbs',
  'no low resolution', 'no pixelation',
]

const MODEL_NEGATIVE: Record<string, string[]> = {
  kling: [...UNIVERSAL_NEGATIVE, 'no morphing artifacts', 'no flickering'],
  seedance: [...UNIVERSAL_NEGATIVE, 'no jarring cuts', 'no unnatural motion'],
  minimax: [...UNIVERSAL_NEGATIVE, 'no glitchy transitions'],
  ltx: [...UNIVERSAL_NEGATIVE],
}

function getNegativePrompt(model: string, userAvoid?: string[]): string {
  const negatives = [...(MODEL_NEGATIVE[model] || UNIVERSAL_NEGATIVE)]
  if (userAvoid?.length) {
    negatives.push(...userAvoid.map(a => `no ${a}`))
  }
  return negatives.join(', ')
}

// ============================================================================
// Prompt Cache — reuse prompts for "try again" requests
// ============================================================================

const promptCache = new Map<string, { prompt: string; negative: string; model: string; brief: CreativeBrief }>()

export function getCachedPrompt(briefHash: string) {
  return promptCache.get(briefHash)
}

function cacheBriefHash(brief: CreativeBrief): string {
  return `${brief.subject}:${brief.mood}:${brief.type}:${brief.platform || ''}`
}

// ============================================================================
// Style Reference Analysis
// ============================================================================

/**
 * Extract style keywords from a reference description.
 * When user says "make it look like [reference]", the Creative Director
 * describes the reference, and we extract style keywords for the prompt.
 */
export function extractStyleFromReference(referenceDescription: string): Partial<CreativeBrief> {
  const desc = referenceDescription.toLowerCase()
  const extracted: Partial<CreativeBrief> = {}

  // Mood detection
  const moodMap: Record<string, string> = {
    'warm': 'warm and inviting',
    'cold': 'cool and clinical',
    'dark': 'dark and moody',
    'bright': 'bright and energetic',
    'dreamy': 'dreamy and ethereal',
    'gritty': 'raw and gritty',
    'minimal': 'clean and minimal',
    'luxurious': 'luxurious and premium',
    'playful': 'playful and fun',
    'serious': 'serious and professional',
  }
  for (const [keyword, mood] of Object.entries(moodMap)) {
    if (desc.includes(keyword)) { extracted.mood = mood; break }
  }

  // Camera detection
  if (desc.includes('close') || desc.includes('macro')) extracted.cameraAngle = 'close-up'
  if (desc.includes('wide') || desc.includes('landscape')) extracted.cameraAngle = 'wide'
  if (desc.includes('overhead') || desc.includes('top down') || desc.includes('bird')) extracted.cameraAngle = 'overhead'
  if (desc.includes('slow') && desc.includes('zoom')) extracted.cameraMovement = 'slow zoom-in'
  if (desc.includes('pan')) extracted.cameraMovement = 'pan'
  if (desc.includes('dolly') || desc.includes('track')) extracted.cameraMovement = 'tracking'
  if (desc.includes('static') || desc.includes('still')) extracted.cameraMovement = 'static'
  if (desc.includes('orbit')) extracted.cameraMovement = 'orbit'

  // Lighting
  if (desc.includes('golden') || desc.includes('sunset')) extracted.lighting = 'golden hour'
  if (desc.includes('neon')) extracted.lighting = 'neon'
  if (desc.includes('studio')) extracted.lighting = 'studio'
  if (desc.includes('natural')) extracted.lighting = 'natural'
  if (desc.includes('dramatic') || desc.includes('shadow')) extracted.lighting = 'dramatic with deep shadows'

  // Style
  if (desc.includes('cinematic') || desc.includes('film')) extracted.style = 'cinematic'
  if (desc.includes('anime')) extracted.style = 'anime'
  if (desc.includes('retro') || desc.includes('vintage')) extracted.style = 'vintage retro'
  if (desc.includes('minimal')) extracted.style = 'minimal clean'

  // Color
  if (desc.includes('muted') || desc.includes('desaturated')) extracted.colorPalette = 'muted'
  if (desc.includes('vibrant') || desc.includes('saturated')) extracted.colorPalette = 'vibrant'

  return extracted
}

// ============================================================================
// Iterative Refinement
// ============================================================================

/**
 * Apply a user's adjustment to an existing brief.
 * Instead of restarting, this merges the change into the existing brief.
 */
export function refineBrief(
  existing: CreativeBrief,
  adjustment: Partial<CreativeBrief>
): CreativeBrief {
  return {
    ...existing,
    ...adjustment,
    // Merge avoid arrays
    avoid: [...(existing.avoid || []), ...(adjustment.avoid || [])],
  }
}

// ============================================================================
// Model-Specific Prompt Builders
// ============================================================================

function buildKlingPrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  if (brief.cameraAngle) parts.push(`${brief.cameraAngle} shot`)
  if (brief.cameraMovement) {
    const speed = brief.cameraSpeed || 'smooth'
    parts.push(`${speed} ${brief.cameraMovement} camera movement`)
  }

  parts.push(`of ${brief.subject}`)
  if (brief.action) parts.push(brief.action)
  if (brief.background) parts.push(`in ${brief.background}`)
  if (brief.lighting) parts.push(`${brief.lighting} lighting`)
  if (brief.mood) parts.push(`${brief.mood} atmosphere`)
  if (brief.colorPalette) parts.push(`${brief.colorPalette} color tones`)

  if (brief.styleReference) parts.push(`styled like ${brief.styleReference}`)

  parts.push('high quality', 'realistic', 'detailed')
  if (brief.style === 'cinematic' || brief.purpose === 'ad') {
    parts.push('cinematic', 'professional')
  }

  return parts.join(', ')
}

function buildSeedancePrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  // Film-style opening
  if (brief.cameraMovement && brief.cameraAngle) {
    const speed = brief.cameraSpeed || 'smooth'
    parts.push(`${speed} ${brief.cameraMovement} ${brief.cameraAngle}`)
  } else if (brief.cameraMovement) {
    parts.push(`smooth ${brief.cameraMovement}`)
  } else if (brief.cameraAngle) {
    parts.push(brief.cameraAngle)
  }

  parts.push(brief.subject)
  if (brief.action) parts.push(brief.action)
  if (brief.background) parts.push(brief.background)
  if (brief.lighting) parts.push(`${brief.lighting} light`)
  if (brief.colorPalette) parts.push(`${brief.colorPalette} palette`)
  if (brief.mood) parts.push(`${brief.mood} mood`)
  if (brief.style) parts.push(`${brief.style} style`)

  if (brief.styleReference) parts.push(`inspired by ${brief.styleReference}`)

  parts.push('cinematic', 'film grain', 'shallow depth of field', 'high production value')

  return parts.join(', ')
}

function buildMinimaxPrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  if (brief.cameraAngle) parts.push(`${brief.cameraAngle} view`)
  if (brief.cameraMovement) parts.push(`${brief.cameraMovement} movement`)
  parts.push(brief.subject)
  if (brief.action) parts.push(brief.action)
  if (brief.background) parts.push(`set in ${brief.background}`)
  if (brief.lighting) parts.push(`with ${brief.lighting} lighting`)
  if (brief.mood) parts.push(`${brief.mood} feeling`)
  if (brief.styleReference) parts.push(`in the style of ${brief.styleReference}`)
  parts.push('professional quality', 'smooth motion')

  return parts.join(', ')
}

function buildLtxPrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  parts.push(brief.subject)
  if (brief.action) parts.push(brief.action)
  if (brief.mood) parts.push(brief.mood)
  if (brief.lighting) parts.push(brief.lighting)
  if (brief.cameraMovement) parts.push(brief.cameraMovement)
  parts.push('high quality')

  return parts.join(', ')
}

function buildImagePrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  if (brief.style) parts.push(`${brief.style} style`)
  parts.push(brief.subject)
  if (brief.action) parts.push(brief.action)
  if (brief.background) parts.push(`in ${brief.background}`)
  if (brief.lighting) parts.push(`${brief.lighting} lighting`)
  if (brief.mood) parts.push(`${brief.mood} mood`)
  if (brief.colorPalette) parts.push(`${brief.colorPalette} tones`)
  if (brief.styleReference) parts.push(`styled like ${brief.styleReference}`)
  parts.push('high quality', 'professional', 'detailed')

  return parts.join(', ')
}

// ============================================================================
// Public API
// ============================================================================

export interface BuiltPrompt {
  prompt: string
  negativePrompt: string
  model: string
  aspectRatio: string
  duration: number
  brief: CreativeBrief
  cacheKey: string
}

/**
 * Build a complete optimized prompt from a creative brief.
 * Returns the positive prompt, negative prompt, model, and all params.
 */
export function buildPromptFromBrief(
  brief: CreativeBrief,
  model?: string
): string {
  // For backward compatibility, return just the prompt string
  const result = buildFullPrompt(brief, model)
  return result.prompt
}

export function buildFullPrompt(
  brief: CreativeBrief,
  modelOverride?: string
): BuiltPrompt {
  const model = modelOverride || recommendModel(brief)
  const aspectRatio = brief.aspectRatio || getAspectRatioForPlatform(brief.platform)
  const duration = brief.duration || 10

  let prompt: string
  if (brief.type === 'image') {
    prompt = buildImagePrompt(brief)
  } else {
    switch (model) {
      case 'seedance': prompt = buildSeedancePrompt(brief); break
      case 'kling': prompt = buildKlingPrompt(brief); break
      case 'minimax': prompt = buildMinimaxPrompt(brief); break
      case 'ltx': prompt = buildLtxPrompt(brief); break
      default: prompt = buildKlingPrompt(brief)
    }
  }

  const negativePrompt = getNegativePrompt(model, brief.avoid)
  const cacheKey = cacheBriefHash(brief)

  // Cache for "try again"
  promptCache.set(cacheKey, { prompt, negative: negativePrompt, model, brief })

  return {
    prompt,
    negativePrompt,
    model,
    aspectRatio,
    duration,
    brief,
    cacheKey,
  }
}

export function getAspectRatioForPlatform(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case 'instagram':
    case 'tiktok':
      return '9:16'
    case 'youtube':
      return '16:9'
    case 'facebook':
      return '1:1'
    case 'linkedin':
      return '16:9'
    default:
      return '16:9'
  }
}

export function recommendModel(brief: CreativeBrief): string {
  if (brief.style === 'cinematic' || brief.purpose === 'ad' || brief.purpose === 'commercial') {
    return 'seedance'
  }

  const humanKeywords = ['person', 'people', 'face', 'talking', 'walking', 'lifestyle', 'model', 'customer', 'employee', 'team']
  if (humanKeywords.some(kw => brief.subject.toLowerCase().includes(kw))) {
    return 'kling'
  }

  if (brief.purpose === 'draft' || brief.purpose === 'test') {
    return 'ltx'
  }

  return 'kling'
}
