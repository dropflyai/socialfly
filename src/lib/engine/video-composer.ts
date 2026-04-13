/**
 * Video Composer — Creatomate Integration
 *
 * Handles post-production video processing:
 * - Merge video + voiceover audio
 * - Add text overlays and captions
 * - Stitch multiple clips with transitions
 * - Resize/format for social platforms
 * - Add brand logo/watermark
 *
 * Uses Creatomate's JSON-based render API.
 */

const CREATOMATE_API = 'https://api.creatomate.com/v2'

function getApiKey(): string {
  const key = process.env.CREATOMATE_API_KEY
  if (!key) throw new Error('CREATOMATE_API_KEY not configured')
  return key
}

// ============================================================================
// Types
// ============================================================================

export interface ComposeRequest {
  // Required
  videoUrl: string

  // Audio
  audioUrl?: string
  audioVolume?: number          // 0-100, default 100
  videoVolume?: number          // 0-100, default 0 if audio provided, else 100

  // Captions/Text
  captionText?: string          // Main caption overlay
  captionPosition?: 'top' | 'center' | 'bottom'
  captionStyle?: 'bold' | 'minimal' | 'outlined' | 'subtitle'
  brandName?: string            // Small brand watermark
  ctaText?: string              // Call-to-action text

  // Format
  outputWidth?: number
  outputHeight?: number
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5'

  // Multi-clip
  additionalClips?: { url: string; duration?: number }[]
  transition?: 'fade' | 'slide' | 'none'
}

export interface ComposeResult {
  id: string
  status: 'planned' | 'rendering' | 'succeeded' | 'failed'
  url: string
  snapshotUrl?: string
}

// ============================================================================
// Aspect Ratio Presets
// ============================================================================

const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },   // Instagram Reels, TikTok
  '16:9': { width: 1920, height: 1080 },   // YouTube, LinkedIn
  '1:1': { width: 1080, height: 1080 },    // Instagram Feed, Facebook
  '4:5': { width: 1080, height: 1350 },    // Instagram Portrait
}

// ============================================================================
// Render Builders
// ============================================================================

/**
 * Build a Creatomate render payload for merging video + audio + captions.
 */
function buildCompositionPayload(req: ComposeRequest) {
  const dims = ASPECT_RATIOS[req.aspectRatio || '16:9'] || ASPECT_RATIOS['16:9']
  const width = req.outputWidth || dims.width
  const height = req.outputHeight || dims.height

  // Build the elements array (layers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements: any[] = []

  // Video layer
  if (req.additionalClips?.length) {
    // Multi-clip: create a composition with sequential clips
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clipElements: any[] = [
      {
        type: 'video',
        source: req.videoUrl,
        fit: 'cover',
      },
    ]

    for (const clip of req.additionalClips) {
      clipElements.push({
        type: 'video',
        source: clip.url,
        fit: 'cover',
        ...(req.transition === 'fade' ? { 'animation_in': { type: 'fade', duration: 0.5 } } : {}),
      })
    }

    elements.push({
      type: 'composition',
      track: 1,
      elements: clipElements,
    })
  } else {
    // Single video
    elements.push({
      type: 'video',
      track: 1,
      source: req.videoUrl,
      fit: 'cover',
      volume: req.audioUrl ? (req.videoVolume ?? 0) + '%' : '100%',
    })
  }

  // Audio layer
  if (req.audioUrl) {
    elements.push({
      type: 'audio',
      track: 2,
      source: req.audioUrl,
      volume: (req.audioVolume ?? 100) + '%',
    })
  }

  // Caption text overlay
  if (req.captionText) {
    const yPosition = req.captionPosition === 'top' ? '10%'
      : req.captionPosition === 'center' ? '50%'
      : '85%'

    const fontWeight = req.captionStyle === 'bold' ? '800' : '600'
    const fontSize = req.captionStyle === 'minimal' ? '4.5 vmin' : '5.5 vmin'
    const backgroundColor = req.captionStyle === 'subtitle'
      ? 'rgba(0,0,0,0.7)'
      : req.captionStyle === 'outlined'
        ? 'transparent'
        : 'rgba(0,0,0,0.5)'

    elements.push({
      type: 'text',
      track: 3,
      text: req.captionText,
      font_family: 'Inter',
      font_weight: fontWeight,
      font_size: fontSize,
      fill_color: '#ffffff',
      background_color: backgroundColor,
      background_x_padding: '8%',
      background_y_padding: '4%',
      background_border_radius: '8 vmin',
      x: '50%',
      y: yPosition,
      width: '85%',
      x_alignment: '50%',
      y_alignment: '50%',
      text_alignment: 'center',
    })
  }

  // CTA text
  if (req.ctaText) {
    elements.push({
      type: 'text',
      track: 4,
      text: req.ctaText,
      font_family: 'Inter',
      font_weight: '700',
      font_size: '4 vmin',
      fill_color: '#ffffff',
      background_color: 'rgba(124,58,237,0.9)',
      background_x_padding: '10%',
      background_y_padding: '5%',
      background_border_radius: '50 vmin',
      x: '50%',
      y: '92%',
      x_alignment: '50%',
      y_alignment: '50%',
    })
  }

  // Brand watermark
  if (req.brandName) {
    elements.push({
      type: 'text',
      track: 5,
      text: req.brandName,
      font_family: 'Inter',
      font_weight: '600',
      font_size: '3 vmin',
      fill_color: 'rgba(255,255,255,0.6)',
      x: '50%',
      y: '5%',
      x_alignment: '50%',
      y_alignment: '50%',
    })
  }

  return {
    output_format: 'mp4',
    width,
    height,
    elements,
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Submit a video composition render to Creatomate.
 * Returns immediately with render ID — poll for status.
 */
export async function composeVideo(req: ComposeRequest): Promise<ComposeResult> {
  const apiKey = getApiKey()
  const payload = buildCompositionPayload(req)

  const res = await fetch(`${CREATOMATE_API}/renders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Creatomate render failed: ${err}`)
  }

  const data = await res.json()

  // API returns an array of renders
  const render = Array.isArray(data) ? data[0] : data

  return {
    id: render.id,
    status: render.status,
    url: render.url,
    snapshotUrl: render.snapshot_url,
  }
}

/**
 * Check the status of a render.
 */
export async function checkComposeStatus(renderId: string): Promise<ComposeResult> {
  const apiKey = getApiKey()

  const res = await fetch(`${CREATOMATE_API}/renders/${renderId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    throw new Error('Failed to check render status')
  }

  const render = await res.json()

  return {
    id: render.id,
    status: render.status,
    url: render.url,
    snapshotUrl: render.snapshot_url,
  }
}

/**
 * Convenience: Merge video + audio into one file.
 */
export async function mergeVideoAudio(
  videoUrl: string,
  audioUrl: string,
  aspectRatio?: string,
): Promise<ComposeResult> {
  return composeVideo({
    videoUrl,
    audioUrl,
    audioVolume: 100,
    videoVolume: 0,
    aspectRatio: (aspectRatio || '16:9') as ComposeRequest['aspectRatio'],
  })
}

/**
 * Convenience: Add captions to a video.
 */
export async function addCaptionsToVideo(
  videoUrl: string,
  captionText: string,
  options?: {
    position?: 'top' | 'center' | 'bottom'
    style?: 'bold' | 'minimal' | 'outlined' | 'subtitle'
    brandName?: string
    ctaText?: string
    aspectRatio?: string
  },
): Promise<ComposeResult> {
  return composeVideo({
    videoUrl,
    captionText,
    captionPosition: options?.position || 'bottom',
    captionStyle: options?.style || 'bold',
    brandName: options?.brandName,
    ctaText: options?.ctaText,
    aspectRatio: (options?.aspectRatio || '16:9') as ComposeRequest['aspectRatio'],
  })
}

/**
 * Convenience: Full composition — video + audio + captions + brand.
 */
export async function createFinalVideo(
  videoUrl: string,
  options: {
    audioUrl?: string
    captionText?: string
    brandName?: string
    ctaText?: string
    aspectRatio?: string
    captionPosition?: 'top' | 'center' | 'bottom'
    captionStyle?: 'bold' | 'minimal' | 'outlined' | 'subtitle'
  },
): Promise<ComposeResult> {
  return composeVideo({
    videoUrl,
    audioUrl: options.audioUrl,
    audioVolume: options.audioUrl ? 100 : undefined,
    videoVolume: options.audioUrl ? 0 : 100,
    captionText: options.captionText,
    captionPosition: options.captionPosition || 'bottom',
    captionStyle: options.captionStyle || 'bold',
    brandName: options.brandName,
    ctaText: options.ctaText,
    aspectRatio: (options.aspectRatio || '9:16') as ComposeRequest['aspectRatio'],
  })
}
