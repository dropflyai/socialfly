/**
 * Smart Audio Router
 *
 * Routes audio/voice generation requests to ElevenLabs with smart voice
 * selection based on:
 * - Content style (narration, voiceover, podcast intro, ad read)
 * - Brand voice profile (tone, audience, industry)
 * - Voice characteristics (gender, tone, accent)
 *
 * Provider:
 * - ElevenLabs — Industry-leading text-to-speech with natural, expressive voices
 *
 * The router scores available voices per request and picks the best match.
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { getConfig, getSupabase } from './config'
import type {
  AudioFormat,
  AudioProvider,
  AudioProviderScore,
  AudioStyle,
  AudioVoice,
  BrandVoice,
  GenerateAudioOptions,
  GeneratedAudio,
} from './types'

// ============================================================================
// Voice Catalog — Curated ElevenLabs Voices
// ============================================================================

const VOICE_CATALOG: AudioVoice[] = [
  // Male voices
  {
    id: 'pNInz6obpgDQGcFmaJgB',   // Adam
    name: 'Adam',
    gender: 'male',
    tone: 'deep',
    bestFor: ['narration', 'podcast_intro'],
    accent: 'american',
    description: 'Deep, authoritative male voice. Great for narration and podcast intros.',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',   // Antoni
    name: 'Antoni',
    gender: 'male',
    tone: 'warm',
    bestFor: ['voiceover', 'ad_read'],
    accent: 'american',
    description: 'Warm, friendly male voice. Ideal for voiceovers and ad reads.',
  },
  {
    id: 'VR6AewLTigWG4xSOukaG',   // Arnold
    name: 'Arnold',
    gender: 'male',
    tone: 'authoritative',
    bestFor: ['narration', 'ad_read'],
    accent: 'american',
    description: 'Strong, authoritative male voice. Suited for powerful narrations and ads.',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',   // Daniel
    name: 'Daniel',
    gender: 'male',
    tone: 'calm',
    bestFor: ['narration', 'voiceover', 'podcast_intro'],
    accent: 'british',
    description: 'Calm, refined British male voice. Excellent for narration and voiceovers.',
  },
  {
    id: 'N2lVS1w4EtoT3dr4eOWO',   // Callum
    name: 'Callum',
    gender: 'male',
    tone: 'energetic',
    bestFor: ['ad_read', 'podcast_intro'],
    accent: 'american',
    description: 'Energetic, upbeat male voice. Perfect for ads and podcast intros.',
  },
  // Female voices
  {
    id: '21m00Tcm4TlvDq8ikWAM',   // Rachel
    name: 'Rachel',
    gender: 'female',
    tone: 'calm',
    bestFor: ['narration', 'voiceover'],
    accent: 'american',
    description: 'Calm, clear female voice. Excellent for narration and voiceovers.',
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',   // Bella
    name: 'Bella',
    gender: 'female',
    tone: 'warm',
    bestFor: ['voiceover', 'ad_read', 'podcast_intro'],
    accent: 'american',
    description: 'Warm, engaging female voice. Great for voiceovers and ad reads.',
  },
  {
    id: 'MF3mGyEYCl7XYWbV9V6O',   // Elli
    name: 'Elli',
    gender: 'female',
    tone: 'energetic',
    bestFor: ['ad_read', 'podcast_intro'],
    accent: 'american',
    description: 'Young, energetic female voice. Perfect for ads and upbeat content.',
  },
  {
    id: 'jBpfuIE2acCO8z3wKNLl',   // Gigi
    name: 'Gigi',
    gender: 'female',
    tone: 'professional',
    bestFor: ['narration', 'voiceover', 'ad_read'],
    accent: 'american',
    description: 'Professional, polished female voice. Suited for business content.',
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',   // Charlotte
    name: 'Charlotte',
    gender: 'female',
    tone: 'authoritative',
    bestFor: ['narration', 'podcast_intro'],
    accent: 'british',
    description: 'Authoritative, sophisticated British female voice. Excellent for narration.',
  },
]

// ============================================================================
// Style-Based Voice Scoring
// ============================================================================

/**
 * Score each voice for a given request based on style, brand, and preferences.
 */
interface AudioRouteRequest {
  text: string
  voiceId?: string
  style?: AudioStyle
  brandVoice?: BrandVoice | null
  preferredGender?: 'male' | 'female' | 'neutral'
  preferredTone?: string
}

function scoreVoice(voice: AudioVoice, request: AudioRouteRequest): { score: number; reasons: string[] } {
  let score = 50
  const reasons: string[] = []

  // Style match — voices that excel at the requested style get a big boost
  if (request.style && voice.bestFor.includes(request.style)) {
    score += 25
    reasons.push(`Voice excels at ${request.style} (+25)`)
  }

  // Gender preference
  if (request.preferredGender && voice.gender === request.preferredGender) {
    score += 15
    reasons.push(`Preferred gender match: ${voice.gender} (+15)`)
  }

  // Tone matching from brand voice
  if (request.brandVoice?.tone) {
    const brandTone = request.brandVoice.tone.toLowerCase()
    const voiceTone = voice.tone.toLowerCase()

    // Direct tone match
    if (brandTone.includes(voiceTone) || voiceTone.includes(brandTone)) {
      score += 20
      reasons.push(`Brand tone "${brandTone}" matches voice tone "${voiceTone}" (+20)`)
    }

    // Semantic tone mapping
    const toneMap: Record<string, string[]> = {
      professional: ['authoritative', 'calm', 'professional'],
      friendly: ['warm', 'energetic'],
      casual: ['warm', 'energetic'],
      authoritative: ['authoritative', 'deep'],
      inspirational: ['warm', 'deep', 'calm'],
      playful: ['energetic', 'warm'],
      serious: ['authoritative', 'deep', 'calm'],
      luxurious: ['calm', 'deep', 'professional'],
    }

    const matchingTones = toneMap[brandTone] || []
    if (matchingTones.includes(voiceTone)) {
      score += 15
      reasons.push(`Voice tone "${voiceTone}" semantically matches brand tone "${brandTone}" (+15)`)
    }
  }

  // Preferred tone override
  if (request.preferredTone) {
    if (voice.tone.toLowerCase() === request.preferredTone.toLowerCase()) {
      score += 20
      reasons.push(`Preferred tone match: ${voice.tone} (+20)`)
    }
  }

  // Prompt keyword analysis for style detection
  const text = request.text.toLowerCase()

  // Narration keywords
  const narrationKeywords = ['once upon', 'story', 'chapter', 'narrator', 'documentary', 'history', 'journey']
  if (narrationKeywords.some(kw => text.includes(kw))) {
    if (voice.bestFor.includes('narration')) {
      score += 10
      reasons.push('Narration keywords detected, voice suited (+10)')
    }
  }

  // Ad/marketing keywords
  const adKeywords = ['buy', 'discount', 'sale', 'offer', 'limited time', 'subscribe', 'try now', 'free trial', 'promo']
  if (adKeywords.some(kw => text.includes(kw))) {
    if (voice.bestFor.includes('ad_read')) {
      score += 10
      reasons.push('Ad/marketing keywords detected, voice suited (+10)')
    }
  }

  // Podcast keywords
  const podcastKeywords = ['welcome to', 'episode', 'podcast', 'today we', 'in this episode', "let's dive"]
  if (podcastKeywords.some(kw => text.includes(kw))) {
    if (voice.bestFor.includes('podcast_intro')) {
      score += 10
      reasons.push('Podcast keywords detected, voice suited (+10)')
    }
  }

  // Industry-based scoring
  if (request.brandVoice?.industry) {
    const industry = request.brandVoice.industry.toLowerCase()

    // Tech/SaaS — professional, calm voices
    if (['tech', 'saas', 'software', 'ai'].some(kw => industry.includes(kw))) {
      if (['calm', 'professional'].includes(voice.tone)) {
        score += 10
        reasons.push(`Tech industry favors ${voice.tone} voice (+10)`)
      }
    }

    // Finance/Legal — authoritative voices
    if (['finance', 'legal', 'banking', 'insurance'].some(kw => industry.includes(kw))) {
      if (['authoritative', 'deep', 'professional'].includes(voice.tone)) {
        score += 10
        reasons.push(`Finance/legal industry favors ${voice.tone} voice (+10)`)
      }
    }

    // Health/Wellness — warm, calm voices
    if (['health', 'wellness', 'fitness', 'medical'].some(kw => industry.includes(kw))) {
      if (['warm', 'calm'].includes(voice.tone)) {
        score += 10
        reasons.push(`Health industry favors ${voice.tone} voice (+10)`)
      }
    }

    // E-commerce/Retail — energetic voices
    if (['ecommerce', 'retail', 'fashion', 'food'].some(kw => industry.includes(kw))) {
      if (['energetic', 'warm'].includes(voice.tone)) {
        score += 10
        reasons.push(`Retail industry favors ${voice.tone} voice (+10)`)
      }
    }
  }

  return { score, reasons }
}

/**
 * Score all available voices for a request.
 */
export function scoreAudioVoices(request: AudioRouteRequest): { voice: AudioVoice; score: number; reasons: string[] }[] {
  const scored = VOICE_CATALOG.map(voice => {
    const { score, reasons } = scoreVoice(voice, request)
    return { voice, score, reasons }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored
}

/**
 * Pick the best voice for a request.
 */
export function pickVoice(request: AudioRouteRequest): AudioVoice {
  // If explicit voice ID, find it in catalog or return a placeholder
  if (request.voiceId) {
    const found = VOICE_CATALOG.find(v => v.id === request.voiceId)
    if (found) return found

    // User provided a custom voice ID not in our catalog
    return {
      id: request.voiceId,
      name: 'Custom Voice',
      gender: 'neutral',
      tone: 'custom',
      bestFor: ['narration', 'voiceover', 'podcast_intro', 'ad_read'],
    }
  }

  const scored = scoreAudioVoices(request)
  return scored[0].voice
}

// ============================================================================
// Style Presets — Voice Settings per Style
// ============================================================================

interface StylePreset {
  stability: number
  similarityBoost: number
  style: number
  useSpeakerBoost: boolean
  modelId: string
  description: string
}

const STYLE_PRESETS: Record<AudioStyle, StylePreset> = {
  narration: {
    stability: 0.65,
    similarityBoost: 0.80,
    style: 0.3,
    useSpeakerBoost: true,
    modelId: 'eleven_multilingual_v2',
    description: 'Smooth, consistent narration with moderate expressiveness',
  },
  voiceover: {
    stability: 0.50,
    similarityBoost: 0.75,
    style: 0.5,
    useSpeakerBoost: true,
    modelId: 'eleven_multilingual_v2',
    description: 'Expressive voiceover with natural variation',
  },
  podcast_intro: {
    stability: 0.40,
    similarityBoost: 0.70,
    style: 0.7,
    useSpeakerBoost: true,
    modelId: 'eleven_multilingual_v2',
    description: 'Energetic, engaging podcast intro with high expressiveness',
  },
  ad_read: {
    stability: 0.55,
    similarityBoost: 0.85,
    style: 0.6,
    useSpeakerBoost: true,
    modelId: 'eleven_multilingual_v2',
    description: 'Clear, persuasive ad read with good projection',
  },
}

// ============================================================================
// ElevenLabs Generation
// ============================================================================

/**
 * Get an initialized ElevenLabs client.
 */
function getElevenLabsClient(): ElevenLabsClient {
  const config = getConfig()
  const apiKey = config.elevenlabsApiKey

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured. Add it to your .env.local file.')
  }

  return new ElevenLabsClient({ apiKey })
}

/**
 * Generate audio via ElevenLabs text-to-speech.
 */
async function generateWithElevenLabs(
  text: string,
  voiceId: string,
  style: AudioStyle,
  options: {
    speed?: number
    stability?: number
    similarityBoost?: number
    outputFormat?: AudioFormat
  } = {},
): Promise<Buffer> {
  const client = getElevenLabsClient()
  const preset = STYLE_PRESETS[style]

  const outputFormat = options.outputFormat || 'mp3_44100_128'

  const response = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: preset.modelId,
    outputFormat,
    voiceSettings: {
      stability: options.stability ?? preset.stability,
      similarityBoost: options.similarityBoost ?? preset.similarityBoost,
      style: preset.style,
      useSpeakerBoost: preset.useSpeakerBoost,
    },
  })

  // The SDK returns a ReadableStream — collect it into a Buffer
  const chunks: Uint8Array[] = []
  const reader = response.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }

  return Buffer.concat(chunks)
}

/**
 * Upload audio buffer to Supabase storage and return the public URL.
 */
async function uploadToStorage(
  audioBuffer: Buffer,
  format: AudioFormat,
  userId?: string,
): Promise<string> {
  const supabase = getSupabase()
  const extension = format.startsWith('mp3') ? 'mp3' : 'wav'
  const mimeType = format.startsWith('mp3') ? 'audio/mpeg' : 'audio/wav'
  const timestamp = Date.now()
  const prefix = userId ? `${userId}` : 'anonymous'
  const filePath = `audio/${prefix}/${timestamp}.${extension}`

  const { error } = await supabase.storage
    .from('media')
    .upload(filePath, audioBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload audio to storage: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('media')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

// ============================================================================
// Brand Voice Loader
// ============================================================================

/**
 * Load brand voice from Supabase for smart voice selection.
 */
async function loadBrandVoiceForAudio(brandId: string): Promise<BrandVoice | null> {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('brand_voices')
      .select('*')
      .eq('id', brandId)
      .single()

    if (!data) return null

    return {
      id: data.id,
      name: data.name,
      tone: data.tone || 'professional',
      description: data.description,
      targetAudience: data.target_audience,
      industry: data.industry,
    }
  } catch {
    return null
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Smart audio generation — selects the best voice based on content, brand, and style.
 */
export async function smartGenerateAudio(
  options: GenerateAudioOptions,
  userId?: string,
): Promise<GeneratedAudio & { routingScore?: { voice: AudioVoice; score: number; reasons: string[] }[] }> {
  const { text, voiceId, brandId, style = 'voiceover' } = options

  // Load brand voice for smart selection
  let brandVoice: BrandVoice | null = null
  if (brandId) {
    brandVoice = await loadBrandVoiceForAudio(brandId)
  }

  const routeRequest: AudioRouteRequest = {
    text,
    voiceId,
    style,
    brandVoice,
  }

  const scores = scoreAudioVoices(routeRequest)
  const selectedVoice = pickVoice(routeRequest)

  // Generate audio
  const audioBuffer = await generateWithElevenLabs(text, selectedVoice.id, style, {
    speed: options.speed,
    stability: options.stability,
    similarityBoost: options.similarityBoost,
    outputFormat: options.outputFormat,
  })

  // Upload to Supabase storage
  const format = options.outputFormat || 'mp3_44100_128'
  const audioUrl = await uploadToStorage(audioBuffer, format, userId)

  // Estimate duration (~150 words per minute for speech)
  const wordCount = text.split(/\s+/).length
  const durationEstimate = Math.round((wordCount / 150) * 60)

  return {
    url: audioUrl,
    text,
    voiceId: selectedVoice.id,
    voiceName: selectedVoice.name,
    provider: 'elevenlabs',
    style,
    durationEstimate,
    routingScore: scores,
  }
}

/**
 * Generate audio with a specific voice (no routing).
 */
export async function generateAudioWithVoice(
  voiceId: string,
  text: string,
  style: AudioStyle = 'voiceover',
  options: {
    speed?: number
    stability?: number
    similarityBoost?: number
    outputFormat?: AudioFormat
    userId?: string
  } = {},
): Promise<GeneratedAudio> {
  const voice = VOICE_CATALOG.find(v => v.id === voiceId) || {
    id: voiceId,
    name: 'Custom Voice',
    gender: 'neutral' as const,
    tone: 'custom',
    bestFor: [] as AudioStyle[],
  }

  const audioBuffer = await generateWithElevenLabs(text, voiceId, style, {
    speed: options.speed,
    stability: options.stability,
    similarityBoost: options.similarityBoost,
    outputFormat: options.outputFormat,
  })

  const format = options.outputFormat || 'mp3_44100_128'
  const audioUrl = await uploadToStorage(audioBuffer, format, options.userId)

  const wordCount = text.split(/\s+/).length
  const durationEstimate = Math.round((wordCount / 150) * 60)

  return {
    url: audioUrl,
    text,
    voiceId: voice.id,
    voiceName: voice.name,
    provider: 'elevenlabs',
    style,
    durationEstimate,
  }
}

/**
 * Get routing explanation for a request (for debugging/transparency).
 */
export function explainAudioRouting(text: string, options?: {
  style?: AudioStyle
  brandVoice?: BrandVoice | null
  preferredGender?: 'male' | 'female' | 'neutral'
  preferredTone?: string
}): { winner: AudioVoice; scores: { voice: AudioVoice; score: number; reasons: string[] }[] } {
  const scores = scoreAudioVoices({ text, ...options })
  return {
    winner: scores[0]?.voice || VOICE_CATALOG[0],
    scores,
  }
}

/**
 * Get all available voices with their details.
 */
export function getAvailableVoices(): AudioVoice[] {
  return VOICE_CATALOG
}

/**
 * Get style presets for reference.
 */
export function getAudioStylePresets(): Record<AudioStyle, { description: string }> {
  return Object.fromEntries(
    Object.entries(STYLE_PRESETS).map(([key, preset]) => [key, { description: preset.description }])
  ) as Record<AudioStyle, { description: string }>
}
