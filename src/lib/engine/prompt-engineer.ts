/**
 * Prompt Engineer — Stage 2 of the conversational creator
 *
 * Takes a structured creative brief and builds model-specific
 * optimized prompts for video and image generation.
 *
 * Each model responds differently to certain keywords, styles, and structures.
 * This module handles those differences so users never need to think about them.
 */

// ============================================================================
// Creative Brief — structured output from the Creative Director
// ============================================================================

export interface CreativeBrief {
  // Core
  type: 'video' | 'image'
  subject: string              // What's in the shot
  action?: string              // What's happening (for video)
  mood: string                 // Emotional tone
  style?: string               // Visual style (cinematic, minimal, etc.)

  // Camera (video)
  cameraAngle?: string         // close-up, wide, overhead, eye-level
  cameraMovement?: string      // pan, zoom, dolly, static, tracking
  cameraSpeed?: string         // slow, medium, fast

  // Visual
  lighting?: string            // golden hour, studio, dramatic, natural
  colorPalette?: string        // warm, cool, muted, vibrant
  background?: string          // what's behind the subject

  // Technical
  platform?: string            // instagram, tiktok, youtube, facebook, linkedin
  aspectRatio?: string         // 9:16, 16:9, 1:1, 4:5
  duration?: number            // seconds (video only)

  // Context
  brandName?: string
  purpose?: string             // ad, reel, story, post, product showcase
  referenceImageUrl?: string   // image-to-video source
}

// ============================================================================
// Model-Specific Prompt Builders
// ============================================================================

/**
 * Build an optimized prompt for Kling.
 * Kling excels at: realistic human motion, natural scenes, product demos.
 * Kling responds well to: detailed action descriptions, lighting terms, camera terminology.
 */
function buildKlingPrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  // Camera and framing first — Kling responds well to this
  if (brief.cameraAngle) parts.push(`${brief.cameraAngle} shot`)
  if (brief.cameraMovement) parts.push(`${brief.cameraMovement} camera movement`)

  // Subject and action
  parts.push(`of ${brief.subject}`)
  if (brief.action) parts.push(brief.action)

  // Environment and lighting
  if (brief.background) parts.push(`in ${brief.background}`)
  if (brief.lighting) parts.push(`${brief.lighting} lighting`)

  // Mood and style
  if (brief.mood) parts.push(`${brief.mood} atmosphere`)
  if (brief.colorPalette) parts.push(`${brief.colorPalette} color tones`)

  // Quality keywords Kling responds to
  parts.push('high quality', 'realistic', 'detailed')
  if (brief.style === 'cinematic' || brief.purpose === 'ad') {
    parts.push('cinematic', 'professional')
  }

  // Safety — prevent unwanted text
  parts.push('no text overlays', 'no watermarks', 'no subtitles')

  return parts.join(', ')
}

/**
 * Build an optimized prompt for Seedance 2.0.
 * Seedance excels at: cinematic quality, character consistency, dramatic motion.
 * Seedance responds well to: film terminology, emotional descriptions, detailed scene descriptions.
 */
function buildSeedancePrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  // Seedance loves film-style scene descriptions
  if (brief.cameraMovement && brief.cameraAngle) {
    parts.push(`${brief.cameraMovement} ${brief.cameraAngle}`)
  } else if (brief.cameraMovement) {
    parts.push(`smooth ${brief.cameraMovement}`)
  } else if (brief.cameraAngle) {
    parts.push(brief.cameraAngle)
  }

  // Subject with cinematic detail
  parts.push(brief.subject)
  if (brief.action) parts.push(brief.action)

  // Rich environmental description
  if (brief.background) parts.push(brief.background)
  if (brief.lighting) parts.push(`${brief.lighting} light`)
  if (brief.colorPalette) parts.push(`${brief.colorPalette} palette`)

  // Emotional and stylistic direction
  if (brief.mood) parts.push(`${brief.mood} mood`)
  if (brief.style) parts.push(`${brief.style} style`)

  // Seedance quality keywords
  parts.push('cinematic', 'film grain', 'shallow depth of field', 'high production value')
  parts.push('no text', 'no watermarks')

  return parts.join(', ')
}

/**
 * Build an optimized prompt for Minimax.
 * Minimax responds well to: clear descriptions, prompt_optimizer handles enhancement.
 */
function buildMinimaxPrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  if (brief.cameraAngle) parts.push(`${brief.cameraAngle} view`)
  parts.push(brief.subject)
  if (brief.action) parts.push(brief.action)
  if (brief.background) parts.push(`set in ${brief.background}`)
  if (brief.lighting) parts.push(`with ${brief.lighting} lighting`)
  if (brief.mood) parts.push(`${brief.mood} feeling`)
  parts.push('professional quality', 'smooth motion')
  parts.push('no text overlays')

  return parts.join(', ')
}

/**
 * Build an optimized prompt for LTX (fast/draft).
 * LTX works best with: simple, clear, concise prompts.
 */
function buildLtxPrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  parts.push(brief.subject)
  if (brief.action) parts.push(brief.action)
  if (brief.mood) parts.push(brief.mood)
  if (brief.lighting) parts.push(brief.lighting)
  parts.push('high quality')

  return parts.join(', ')
}

/**
 * Build an optimized prompt for image generation.
 */
function buildImagePrompt(brief: CreativeBrief): string {
  const parts: string[] = []

  if (brief.style) parts.push(`${brief.style} style`)
  parts.push(brief.subject)
  if (brief.background) parts.push(`in ${brief.background}`)
  if (brief.lighting) parts.push(`${brief.lighting} lighting`)
  if (brief.mood) parts.push(`${brief.mood} mood`)
  if (brief.colorPalette) parts.push(`${brief.colorPalette} tones`)
  parts.push('high quality', 'professional', 'detailed')

  return parts.join(', ')
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build an optimized prompt from a creative brief for the specified model.
 */
export function buildPromptFromBrief(
  brief: CreativeBrief,
  model: string = 'kling'
): string {
  if (brief.type === 'image') {
    return buildImagePrompt(brief)
  }

  switch (model) {
    case 'seedance': return buildSeedancePrompt(brief)
    case 'kling': return buildKlingPrompt(brief)
    case 'minimax': return buildMinimaxPrompt(brief)
    case 'ltx': return buildLtxPrompt(brief)
    default: return buildKlingPrompt(brief)
  }
}

/**
 * Determine the best aspect ratio for a given platform.
 */
export function getAspectRatioForPlatform(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case 'instagram':
    case 'tiktok':
      return '9:16'   // Vertical reels
    case 'youtube':
      return '16:9'   // Landscape
    case 'facebook':
      return '1:1'    // Square performs best on FB
    case 'linkedin':
      return '16:9'   // Professional landscape
    default:
      return '16:9'
  }
}

/**
 * Pick the best model based on the creative brief.
 */
export function recommendModel(brief: CreativeBrief): string {
  // Premium cinematic content → Seedance
  if (brief.style === 'cinematic' || brief.purpose === 'ad' || brief.purpose === 'commercial') {
    return 'seedance'
  }

  // People, lifestyle, product demos → Kling
  const humanKeywords = ['person', 'people', 'face', 'talking', 'walking', 'lifestyle', 'model', 'customer']
  if (humanKeywords.some(kw => brief.subject.toLowerCase().includes(kw))) {
    return 'kling'
  }

  // Quick drafts
  if (brief.purpose === 'draft' || brief.purpose === 'test') {
    return 'ltx'
  }

  // Default to Kling — best value
  return 'kling'
}
