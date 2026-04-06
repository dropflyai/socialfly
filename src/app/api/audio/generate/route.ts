import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { deductCredits } from '@/lib/credits'
import { checkFeatureAccess } from '@/lib/tier-gates'
import {
  smartGenerateAudio,
  generateAudioWithVoice,
  getAvailableVoices,
  getAudioStylePresets,
} from '@/lib/engine/audio-router'
import type { AudioStyle, AudioFormat } from '@/lib/engine/types'

// ElevenLabs can take a while for long texts
export const maxDuration = 120

const VALID_STYLES: AudioStyle[] = ['narration', 'voiceover', 'podcast_intro', 'ad_read']
const VALID_FORMATS: AudioFormat[] = ['mp3_44100_128', 'mp3_22050_32', 'pcm_16000', 'pcm_44100']

/**
 * GET /api/audio/generate
 * Returns available voices and style presets.
 */
export async function GET() {
  return NextResponse.json({
    voices: getAvailableVoices(),
    styles: getAudioStylePresets(),
  })
}

/**
 * POST /api/audio/generate
 * Generate audio from text using ElevenLabs.
 *
 * Body:
 * - text: string (required) — The text to convert to speech
 * - voice_id: string (optional) — Explicit ElevenLabs voice ID
 * - brand_id: string (optional) — Brand ID for smart voice selection
 * - style: 'narration' | 'voiceover' | 'podcast_intro' | 'ad_read' (optional, default: 'voiceover')
 * - speed: number (optional) — Playback speed 0.5-2.0
 * - stability: number (optional) — Voice stability 0.0-1.0
 * - similarity_boost: number (optional) — Voice similarity 0.0-1.0
 * - output_format: string (optional) — Audio format (default: 'mp3_44100_128')
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateCheck = checkRateLimit(`${user.id}:audio-generate`, RATE_LIMITS.videoGenerate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before generating more audio.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  // Audio generation requires Pro or higher (same gate as video)
  const featureCheck = await checkFeatureAccess(user.id, 'video_generation')
  if (!featureCheck.allowed) {
    return NextResponse.json(
      { error: featureCheck.reason, upgradeRequired: featureCheck.upgradeRequired },
      { status: 403 }
    )
  }

  const body = await request.json()
  const {
    text,
    voice_id: voiceId,
    brand_id: brandId,
    style = 'voiceover',
    speed,
    stability,
    similarity_boost: similarityBoost,
    output_format: outputFormat,
  } = body

  // Validate required fields
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid "text" field' }, { status: 400 })
  }

  if (text.length > 5000) {
    return NextResponse.json({ error: 'Text too long. Maximum 5000 characters.' }, { status: 400 })
  }

  if (text.trim().length === 0) {
    return NextResponse.json({ error: 'Text cannot be empty' }, { status: 400 })
  }

  // Validate style
  if (style && !VALID_STYLES.includes(style as AudioStyle)) {
    return NextResponse.json(
      { error: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate output format
  if (outputFormat && !VALID_FORMATS.includes(outputFormat as AudioFormat)) {
    return NextResponse.json(
      { error: `Invalid output format. Must be one of: ${VALID_FORMATS.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate numeric ranges
  if (speed !== undefined && (typeof speed !== 'number' || speed < 0.5 || speed > 2.0)) {
    return NextResponse.json({ error: 'Speed must be a number between 0.5 and 2.0' }, { status: 400 })
  }

  if (stability !== undefined && (typeof stability !== 'number' || stability < 0 || stability > 1)) {
    return NextResponse.json({ error: 'Stability must be a number between 0.0 and 1.0' }, { status: 400 })
  }

  if (similarityBoost !== undefined && (typeof similarityBoost !== 'number' || similarityBoost < 0 || similarityBoost > 1)) {
    return NextResponse.json({ error: 'Similarity boost must be a number between 0.0 and 1.0' }, { status: 400 })
  }

  // Credit check — audio generation uses the same cost as image generation
  const creditResult = await deductCredits(user.id, 'image_generate', { type: 'audio' })
  if (!creditResult.success) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.', creditsRemaining: creditResult.creditsRemaining },
      { status: 402 }
    )
  }

  try {
    let result

    if (voiceId) {
      // User chose a specific voice — skip routing
      result = await generateAudioWithVoice(voiceId, text, style as AudioStyle, {
        speed,
        stability,
        similarityBoost,
        outputFormat: outputFormat as AudioFormat | undefined,
        userId: user.id,
      })
    } else {
      // Smart routing — picks the best voice based on text, brand, and style
      result = await smartGenerateAudio({
        text,
        brandId,
        style: style as AudioStyle,
        speed,
        stability,
        similarityBoost,
        outputFormat: outputFormat as AudioFormat | undefined,
      }, user.id)
    }

    return NextResponse.json({
      success: true,
      audioUrl: result.url,
      voiceId: result.voiceId,
      voiceName: result.voiceName,
      provider: result.provider,
      style: result.style,
      durationEstimate: result.durationEstimate,
      routingScore: 'routingScore' in result ? result.routingScore : undefined,
    })
  } catch (error) {
    console.error('Audio generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audio generation failed' },
      { status: 500 }
    )
  }
}
