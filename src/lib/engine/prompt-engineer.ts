/**
 * Prompt Engineer v2 — Scene-Based Screenwriter
 *
 * Instead of keyword soup, this writes prompts like screenplay directions.
 * Each prompt describes a scene unfolding over time — what the camera does,
 * what the subject does, how the light falls, what the viewer feels.
 *
 * The Creative Director extracts structured scene data from conversation.
 * This module turns that into model-specific cinematic descriptions.
 */

// ============================================================================
// Creative Brief — what the Creative Director extracts from conversation
// ============================================================================

export interface CreativeBrief {
  type: 'video' | 'image'

  // Scene essentials
  subject: string              // WHO or WHAT is in the shot — be specific
  subjectDetails?: string      // Appearance, clothing, expression
  action?: string              // WHAT is happening — specific motion
  motionDirection?: string     // Direction of movement (left to right, toward camera, etc.)

  // Scene setting
  setting?: string             // WHERE — specific location
  timeOfDay?: string           // Dawn, morning, golden hour, noon, sunset, night, etc.
  weather?: string             // Clear, overcast, rain, fog, snow, etc.

  // Camera
  shotSize?: string            // Extreme close-up, close-up, medium, wide, extreme wide
  cameraMovement?: string      // Dolly-in, dolly-out, pan left, pan right, tracking, orbit, crane up, static
  cameraSpeed?: string         // Slow, medium, fast
  cameraHeight?: string        // Low angle, eye level, high angle, overhead, ground level

  // Mood & style
  mood: string                 // Emotional tone
  style?: string               // Cinematic, documentary, commercial, indie, music video, etc.
  colorGrade?: string          // Warm tones, cool tones, desaturated, vibrant, teal and orange, etc.

  // Lighting
  lighting?: string            // Natural, studio, dramatic, soft, backlit, rim light, etc.
  lightDirection?: string      // Side light, front light, backlight, overhead, etc.

  // Technical
  platform?: string
  aspectRatio?: string
  duration?: number
  lensStyle?: string           // Wide angle, telephoto, macro, anamorphic, fish-eye

  // Context
  brandName?: string
  purpose?: string
  referenceImageUrl?: string
  avoid?: string[]
  styleReference?: string
}

// ============================================================================
// Scene Templates — per content type
// ============================================================================

interface SceneTemplate {
  opener: (b: CreativeBrief) => string
  middle: (b: CreativeBrief) => string
  closer: (b: CreativeBrief) => string
  style: (b: CreativeBrief) => string
}

const SCENE_TEMPLATES: Record<string, SceneTemplate> = {
  product_showcase: {
    opener: (b) => `${cameraPhrase(b)} of ${subjectPhrase(b)}`,
    middle: (b) => b.action || 'rotating slowly to reveal every detail',
    closer: (b) => `${settingPhrase(b)}, ${lightingPhrase(b)}`,
    style: (b) => `${b.style || 'commercial'} feel, ${b.lensStyle || 'shallow depth of field'}, pristine product photography aesthetic, ${b.colorGrade || 'clean neutral tones'}`,
  },
  lifestyle: {
    opener: (b) => `${cameraPhrase(b)} following ${subjectPhrase(b)}`,
    middle: (b) => b.action || 'moving naturally through the space',
    closer: (b) => `${settingPhrase(b)}, ${lightingPhrase(b)}, capturing an authentic candid moment`,
    style: (b) => `${b.style || 'lifestyle'} feel, ${b.lensStyle || 'natural lens flare'}, ${b.colorGrade || 'warm film tones'}, shot on location`,
  },
  food_beverage: {
    opener: (b) => `${cameraPhrase(b)} of ${subjectPhrase(b)}`,
    middle: (b) => b.action || 'with steam gently rising, liquid catching the light',
    closer: (b) => `${settingPhrase(b)}, ${lightingPhrase(b)}, every texture and droplet visible`,
    style: (b) => `food photography aesthetic, ${b.lensStyle || 'macro detail shots'}, ${b.colorGrade || 'rich warm tones'}, appetizing and inviting`,
  },
  nature_landscape: {
    opener: (b) => `${cameraPhrase(b)} revealing ${subjectPhrase(b)}`,
    middle: (b) => b.action || 'with gentle movement in the wind, light shifting across the scene',
    closer: (b) => `${settingPhrase(b)}, ${lightingPhrase(b)}, vast and immersive`,
    style: (b) => `${b.style || 'cinematic'} landscape photography, ${b.lensStyle || 'wide anamorphic lens'}, ${b.colorGrade || 'deep rich colors'}, epic sense of scale`,
  },
  brand_story: {
    opener: (b) => `${cameraPhrase(b)} on ${subjectPhrase(b)}`,
    middle: (b) => b.action || 'engaging with the viewer, telling a story through expression and gesture',
    closer: (b) => `${settingPhrase(b)}, ${lightingPhrase(b)}, intimate and authentic`,
    style: (b) => `${b.style || 'documentary'} storytelling, ${b.lensStyle || '35mm film look'}, ${b.colorGrade || 'cinematic color grade'}, emotionally resonant`,
  },
  social_reel: {
    opener: (b) => `${cameraPhrase(b)} of ${subjectPhrase(b)}`,
    middle: (b) => b.action || 'with dynamic energy and eye-catching movement',
    closer: (b) => `${settingPhrase(b)}, ${lightingPhrase(b)}, designed to stop the scroll`,
    style: (b) => `trendy social media aesthetic, ${b.lensStyle || 'close and personal framing'}, ${b.colorGrade || 'punchy vibrant colors'}, high energy, vertical format`,
  },
  default: {
    opener: (b) => `${cameraPhrase(b)} of ${subjectPhrase(b)}`,
    middle: (b) => b.action || 'in a natural fluid motion',
    closer: (b) => `${settingPhrase(b)}, ${lightingPhrase(b)}`,
    style: (b) => `${b.style || 'cinematic'} quality, ${b.lensStyle || 'shallow depth of field'}, ${b.colorGrade || 'professional color grading'}, high production value`,
  },
}

// ============================================================================
// Phrase Builders — natural language fragments
// ============================================================================

function cameraPhrase(b: CreativeBrief): string {
  const speed = b.cameraSpeed || 'smooth'
  const movement = b.cameraMovement || 'static'
  const size = b.shotSize || 'medium'
  const height = b.cameraHeight ? `, ${b.cameraHeight}` : ''

  if (movement === 'static') {
    return `${size} shot${height}`
  }
  return `${speed} ${movement} ${size} shot${height}`
}

function subjectPhrase(b: CreativeBrief): string {
  let phrase = b.subject
  if (b.subjectDetails) phrase += `, ${b.subjectDetails}`
  return phrase
}

function settingPhrase(b: CreativeBrief): string {
  const parts: string[] = []
  if (b.setting) parts.push(`set in ${b.setting}`)
  if (b.timeOfDay) parts.push(`during ${b.timeOfDay}`)
  if (b.weather) parts.push(`${b.weather} conditions`)
  return parts.length > 0 ? parts.join(', ') : 'in a professional setting'
}

function lightingPhrase(b: CreativeBrief): string {
  const parts: string[] = []
  if (b.lighting) parts.push(`${b.lighting} lighting`)
  if (b.lightDirection) parts.push(`from ${b.lightDirection}`)
  return parts.length > 0 ? parts.join(' ') : 'with beautiful natural light'
}

// ============================================================================
// Detect content type from brief
// ============================================================================

function detectContentType(b: CreativeBrief): string {
  const subject = (b.subject + ' ' + (b.action || '') + ' ' + (b.setting || '')).toLowerCase()

  if (['product', 'bottle', 'package', 'device', 'gadget', 'shoe', 'watch'].some(kw => subject.includes(kw))) return 'product_showcase'
  if (['person', 'people', 'woman', 'man', 'customer', 'team', 'model', 'walking', 'talking'].some(kw => subject.includes(kw))) return 'lifestyle'
  if (['food', 'coffee', 'latte', 'drink', 'meal', 'dish', 'cocktail', 'tea', 'beer', 'wine', 'cooking', 'pour'].some(kw => subject.includes(kw))) return 'food_beverage'
  if (['mountain', 'ocean', 'forest', 'sunset', 'sky', 'river', 'beach', 'landscape', 'nature', 'field', 'garden'].some(kw => subject.includes(kw))) return 'nature_landscape'
  if (['brand', 'story', 'founder', 'behind the scenes', 'interview', 'testimonial'].some(kw => subject.includes(kw))) return 'brand_story'
  if (b.platform === 'instagram' || b.platform === 'tiktok' || b.purpose === 'reel') return 'social_reel'

  return 'default'
}

// ============================================================================
// Negative Prompts
// ============================================================================

const UNIVERSAL_NEGATIVE = 'no text overlays, no watermarks, no subtitles, no logos, no blurry frames, no distorted faces, no extra limbs, no morphing artifacts'

const MODEL_NEGATIVE: Record<string, string> = {
  kling: `${UNIVERSAL_NEGATIVE}, no flickering, no jittery motion`,
  seedance: `${UNIVERSAL_NEGATIVE}, no jarring cuts, no unnatural motion, no static frames`,
  minimax: `${UNIVERSAL_NEGATIVE}, no glitchy transitions`,
  ltx: UNIVERSAL_NEGATIVE,
}

// ============================================================================
// Model-Specific Scene Writers
// ============================================================================

function writeKlingScene(scene: string): string {
  // Kling responds best to detailed 3-5 sentence descriptions
  return scene
}

function writeSeedanceScene(scene: string): string {
  // Seedance likes film terminology and emotional language
  return scene + ', shot on 35mm film stock, film grain texture'
}

function writeMinimaxScene(scene: string): string {
  // Minimax works better with concise prompts — trim to essentials
  const sentences = scene.split(/[,.]+/).filter(s => s.trim().length > 5)
  return sentences.slice(0, 6).join(', ')
}

function writeLtxScene(scene: string): string {
  // LTX needs short, simple prompts
  const sentences = scene.split(/[,.]+/).filter(s => s.trim().length > 5)
  return sentences.slice(0, 3).join(', ')
}

// ============================================================================
// The Screenwriter — builds the full scene description
// ============================================================================

function writeScene(brief: CreativeBrief): string {
  const contentType = detectContentType(brief)
  const template = SCENE_TEMPLATES[contentType] || SCENE_TEMPLATES.default

  // Build the scene like a screenplay direction
  const opener = template.opener(brief)
  const middle = template.middle(brief)
  const closer = template.closer(brief)
  const style = template.style(brief)

  // Compose into a natural scene description
  return `${opener}, ${middle}. ${closer}. ${style}.`
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
  contentType: string
}

export function buildFullPrompt(brief: CreativeBrief, modelOverride?: string): BuiltPrompt {
  const model = modelOverride || recommendModel(brief)
  const aspectRatio = brief.aspectRatio || getAspectRatioForPlatform(brief.platform)
  const duration = brief.duration || 10
  const contentType = detectContentType(brief)

  let prompt: string

  if (brief.type === 'image') {
    prompt = writeImageScene(brief, model)
  } else {
    const rawScene = writeScene(brief)

    // Apply model-specific adjustments
    switch (model) {
      case 'kling': prompt = writeKlingScene(rawScene); break
      case 'seedance': prompt = writeSeedanceScene(rawScene); break
      case 'minimax': prompt = writeMinimaxScene(rawScene); break
      case 'ltx': prompt = writeLtxScene(rawScene); break
      default: prompt = rawScene
    }
  }

  // Append style reference if provided
  if (brief.styleReference) {
    prompt += `, inspired by the visual style of ${brief.styleReference}`
  }

  const negativePrompt = MODEL_NEGATIVE[model] || UNIVERSAL_NEGATIVE
  const cacheKey = `${brief.subject}:${brief.mood}:${brief.type}:${brief.platform || ''}`

  return { prompt, negativePrompt, model, aspectRatio, duration, brief, cacheKey, contentType }
}

// Backward compatibility
export function buildPromptFromBrief(brief: CreativeBrief, model?: string): string {
  return buildFullPrompt(brief, model).prompt
}

// ============================================================================
// Image Scene Writers — model-specific
// ============================================================================

/**
 * Write a natural language image scene description.
 * Used for Gemini and DALL-E which prefer descriptive prose.
 */
function writeImageSceneNatural(brief: CreativeBrief): string {
  const sentences: string[] = []

  // Opening — what we're looking at
  const shotDesc = brief.shotSize ? `${brief.shotSize} ` : ''
  const styleDesc = brief.style ? `${brief.style} ` : ''
  sentences.push(`A ${styleDesc}${shotDesc}photograph of ${subjectPhrase(brief)}`)

  // Action and setting
  if (brief.action) sentences[0] += ` ${brief.action}`
  if (brief.setting) sentences.push(`set in ${brief.setting}`)
  if (brief.timeOfDay) sentences[sentences.length - 1] += ` during ${brief.timeOfDay}`

  // Lighting — describe it cinematically
  if (brief.lighting) {
    const dir = brief.lightDirection ? ` from the ${brief.lightDirection}` : ''
    sentences.push(`${brief.lighting}${dir} creates a ${brief.mood || 'beautiful'} atmosphere`)
  } else if (brief.mood) {
    sentences.push(`the scene has a ${brief.mood} feel`)
  }

  // Technical details woven in naturally
  if (brief.lensStyle) sentences.push(`shot with ${brief.lensStyle}`)
  if (brief.colorGrade) sentences.push(`with ${brief.colorGrade}`)
  if (brief.setting && !sentences.some(s => s.includes(brief.setting!))) sentences.push(`with a ${brief.setting} background`)

  sentences.push('professional quality, highly detailed, 4K resolution')

  return sentences.join(', ')
}

/**
 * Write a keyword-structured image prompt.
 * Used for Flux/Fal and Stability which prefer structured keywords.
 */
function writeImageSceneStructured(brief: CreativeBrief): string {
  const parts: string[] = []

  // Subject first — most important for these models
  parts.push(subjectPhrase(brief))
  if (brief.action) parts.push(brief.action)

  // Setting and context
  if (brief.setting) parts.push(brief.setting)
  // setting already captured above
  if (brief.timeOfDay) parts.push(`${brief.timeOfDay} light`)

  // Visual style block
  if (brief.style) parts.push(`${brief.style} style`)
  if (brief.shotSize) parts.push(`${brief.shotSize} shot`)
  if (brief.lighting) parts.push(`${brief.lighting} lighting`)
  if (brief.lightDirection) parts.push(`${brief.lightDirection} light`)
  if (brief.colorGrade) parts.push(brief.colorGrade)
  if (brief.mood) parts.push(`${brief.mood} mood`)
  if (brief.lensStyle) parts.push(brief.lensStyle)

  // Quality keywords these models respond to
  parts.push('masterpiece', 'best quality', 'highly detailed', 'sharp focus', '8k uhd')

  return parts.join(', ')
}

/**
 * Content-type aware image scene — picks the right photography style.
 */
function writeImageScene(brief: CreativeBrief, model?: string): string {
  const contentType = detectContentType(brief)

  // Add content-type specific quality keywords
  let suffix = ''
  switch (contentType) {
    case 'food_beverage':
      suffix = ', food photography, appetizing, editorial quality, magazine cover worthy'
      break
    case 'product_showcase':
      suffix = ', product photography, clean background, studio lighting, commercial quality'
      break
    case 'lifestyle':
      suffix = ', lifestyle photography, authentic, candid, editorial'
      break
    case 'nature_landscape':
      suffix = ', landscape photography, epic, breathtaking, national geographic quality'
      break
    case 'brand_story':
      suffix = ', portrait photography, emotional, storytelling, editorial'
      break
    case 'social_reel':
      suffix = ', social media ready, eye-catching, vibrant, scroll-stopping'
      break
  }

  // Pick prompt style based on model
  if (model === 'nanobanana' || model === 'dalle') {
    return writeImageSceneNatural(brief) + suffix
  }

  // Default to structured for Fal/Stability
  return writeImageSceneStructured(brief) + suffix
}

export function getAspectRatioForPlatform(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case 'instagram': case 'tiktok': return '9:16'
    case 'youtube': return '16:9'
    case 'facebook': return '1:1'
    case 'linkedin': return '16:9'
    default: return '16:9'
  }
}

export function recommendModel(brief: CreativeBrief): string {
  if (brief.style === 'cinematic' || brief.purpose === 'ad' || brief.purpose === 'commercial') return 'seedance'
  if (['person', 'people', 'face', 'talking', 'walking', 'lifestyle', 'model', 'customer', 'employee', 'team', 'dancing'].some(kw => brief.subject.toLowerCase().includes(kw))) return 'kling'
  if (brief.purpose === 'draft' || brief.purpose === 'test') return 'ltx'
  return 'kling'
}

// Style reference extraction
export function extractStyleFromReference(desc: string): Partial<CreativeBrief> {
  const d = desc.toLowerCase()
  const extracted: Partial<CreativeBrief> = {}

  if (d.includes('warm') || d.includes('golden')) extracted.colorGrade = 'warm golden tones'
  if (d.includes('cool') || d.includes('blue')) extracted.colorGrade = 'cool blue tones'
  if (d.includes('muted') || d.includes('desaturated')) extracted.colorGrade = 'muted desaturated'
  if (d.includes('vibrant') || d.includes('saturated')) extracted.colorGrade = 'vibrant saturated'
  if (d.includes('dark') || d.includes('moody')) { extracted.mood = 'dark and moody'; extracted.lighting = 'dramatic low key' }
  if (d.includes('bright') || d.includes('airy')) { extracted.mood = 'bright and airy'; extracted.lighting = 'soft diffused' }
  if (d.includes('cinematic')) extracted.style = 'cinematic'
  if (d.includes('retro') || d.includes('vintage')) { extracted.style = 'vintage'; extracted.colorGrade = 'faded film stock colors' }
  if (d.includes('slow')) extracted.cameraSpeed = 'slow'
  if (d.includes('zoom')) extracted.cameraMovement = 'zoom-in'
  if (d.includes('pan')) extracted.cameraMovement = 'pan'
  if (d.includes('dolly') || d.includes('track')) extracted.cameraMovement = 'tracking'

  return extracted
}

export function refineBrief(existing: CreativeBrief, adjustment: Partial<CreativeBrief>): CreativeBrief {
  return {
    ...existing,
    ...adjustment,
    avoid: [...(existing.avoid || []), ...(adjustment.avoid || [])],
  }
}
