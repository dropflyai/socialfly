/**
 * Content Orchestra
 *
 * Unified orchestration layer that coordinates ALL content generation providers
 * into one intelligent pipeline. Takes a high-level content brief and produces
 * text, images, video, and audio in the correct dependency order with:
 *
 * - Quality gates after each step
 * - Cascading fallbacks on provider failure
 * - Provider performance tracking
 * - A/B testing for image providers
 * - Cost optimization based on budget tier
 * - Smart post-processing enhancement
 *
 * The orchestra WRAPS the existing routers (image-router, video-router,
 * audio-router) — it does not replace them.
 */

import { getConfig, getSupabase } from './config'
import { generateContent } from './generate'
import {
  smartGenerateImage,
  scoreProviders as scoreImageProviders,
} from './image-router'
import {
  smartGenerateVideo,
  generateVideoWithProvider,
} from './video-router'
import {
  smartGenerateAudio,
} from './audio-router'
import {
  removeBackground,
  upscaleImage,
} from './replicate-tools'
import type {
  Platform,
  ImageProvider,
  VideoProvider,
  AudioStyle,
  OrchestraRequest,
  OrchestraResult,
  OrchestraTextResult,
  OrchestraImageResult,
  OrchestraVideoResult,
  OrchestraAudioResult,
  OrchestraPostProcessingResult,
  OrchestraProviderBreakdown,
  ProviderPerformanceRecord,
  ProviderPerformanceReport,
  SpendReport,
  OrchestraBudget,
} from './types'

// ============================================================================
// Cost Estimates (per generation, in USD)
// ============================================================================

const IMAGE_COSTS: Record<string, number> = {
  fal: 0.03,
  nanobanana: 0.01,
  dalle: 0.08,
  stability: 0.04,
}

const VIDEO_COSTS: Record<string, number> = {
  seedance: 0.80,
  minimax: 0.50,
  ltx: 0.02,
}

const AUDIO_COST_PER_CHAR = 0.00003 // ElevenLabs ~$0.30 per 10k chars

const TEXT_COST_PER_TOKEN = 0.000003 // Claude Sonnet approximate

// ============================================================================
// Budget-to-Provider Mapping
// ============================================================================

const BUDGET_IMAGE_PREFERENCES: Record<OrchestraBudget, ImageProvider[]> = {
  low: ['nanobanana', 'fal', 'stability', 'dalle'],
  medium: ['fal', 'nanobanana', 'stability', 'dalle'],
  premium: ['dalle', 'fal', 'nanobanana', 'stability'],
}

const BUDGET_VIDEO_PREFERENCES: Record<OrchestraBudget, VideoProvider[]> = {
  low: ['ltx', 'minimax', 'seedance'],
  medium: ['minimax', 'seedance', 'ltx'],
  premium: ['seedance', 'minimax', 'ltx'],
}

// ============================================================================
// Platform Quality Requirements
// ============================================================================

const PLATFORM_TEXT_LIMITS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  tiktok: 150,
  linkedin: 3000,
  facebook: 500,
}

const HIGH_RES_PLATFORMS = new Set(['instagram', 'facebook', 'linkedin'])
const PRODUCT_SHOT_KEYWORDS = ['product', 'e-commerce', 'catalog', 'merchandise', 'item', 'shop']

// ============================================================================
// Provider Performance Tracking
// ============================================================================

// In-memory failure rate tracker for cascading fallbacks
const failureTracker = new Map<string, { failures: number; total: number; lastFailure: number }>()

function recordProviderAttempt(provider: string, contentType: string, success: boolean): void {
  const key = `${provider}:${contentType}`
  const entry = failureTracker.get(key) || { failures: 0, total: 0, lastFailure: 0 }
  entry.total++
  if (!success) {
    entry.failures++
    entry.lastFailure = Date.now()
  }
  failureTracker.set(key, entry)
}

function getFailureRate(provider: string, contentType: string): number {
  const key = `${provider}:${contentType}`
  const entry = failureTracker.get(key)
  if (!entry || entry.total === 0) return 0
  return entry.failures / entry.total
}

/**
 * Log provider performance to Supabase for long-term analytics.
 */
async function logProviderPerformance(record: ProviderPerformanceRecord): Promise<void> {
  try {
    const supabase = getSupabase()
    await supabase.from('provider_performance').insert({
      provider: record.provider,
      content_type: record.content_type,
      success: record.success,
      generation_time_ms: record.generation_time_ms,
      estimated_cost: record.estimated_cost,
      was_fallback: record.was_fallback,
      ab_test_group: record.ab_test_group || null,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // Non-critical — don't fail the pipeline for logging errors
    console.warn('[Orchestra] Failed to log provider performance:', err instanceof Error ? err.message : err)
  }
}

// ============================================================================
// Quality Gates
// ============================================================================

function validateTextQuality(
  text: string,
  platforms: Platform[],
): { score: number; warnings: string[] } {
  let score = 80
  const warnings: string[] = []

  if (!text || text.trim().length === 0) {
    return { score: 0, warnings: ['Text content is empty'] }
  }

  for (const platform of platforms) {
    const limit = PLATFORM_TEXT_LIMITS[platform]
    if (limit && text.length > limit) {
      score -= 10
      warnings.push(`Text exceeds ${platform} limit (${text.length}/${limit} chars)`)
    }
  }

  // Check for basic quality signals
  if (text.length < 20) {
    score -= 15
    warnings.push('Text is very short — may lack engagement value')
  }

  // Bonus for having hashtags on hashtag-friendly platforms
  const hashtagPlatforms = ['instagram', 'twitter', 'tiktok']
  const hasHashtags = /#\w+/.test(text)
  if (platforms.some(p => hashtagPlatforms.includes(p)) && hasHashtags) {
    score += 5
  }

  return { score: Math.max(0, Math.min(100, score)), warnings }
}

function validateImageQuality(
  url: string,
  platforms: Platform[],
): { score: number; warnings: string[] } {
  let score = 85
  const warnings: string[] = []

  if (!url || url.trim().length === 0) {
    return { score: 0, warnings: ['Image URL is empty'] }
  }

  // Data URLs from Nano Banana are valid but may be large
  if (url.startsWith('data:')) {
    score -= 5
    warnings.push('Image is a data URL — may need to be uploaded for some platforms')
  }

  return { score: Math.max(0, Math.min(100, score)), warnings }
}

// ============================================================================
// Smart Enhancement Pipeline
// ============================================================================

async function maybeEnhanceImage(
  imageUrl: string,
  platforms: Platform[],
  brief: string,
  budget: OrchestraBudget,
): Promise<OrchestraPostProcessingResult | undefined> {
  // Skip enhancement for low budget
  if (budget === 'low') return undefined

  const config = getConfig()
  if (!config.replicateApiToken) return undefined

  const applied: string[] = []
  let currentUrl = imageUrl
  const beforeUrl = imageUrl

  // Upscale for high-res platforms on premium budget
  const needsHighRes = platforms.some(p => HIGH_RES_PLATFORMS.has(p))
  if (needsHighRes && budget === 'premium') {
    try {
      const upscaleResult = await upscaleImage(currentUrl, 2)
      if (upscaleResult.success) {
        currentUrl = upscaleResult.url
        applied.push('upscale_2x')
      }
    } catch (err) {
      console.warn('[Orchestra] Upscale failed, continuing without:', err instanceof Error ? err.message : err)
    }
  }

  // Remove background for product shots (budget already confirmed non-low above)
  const isProductShot = PRODUCT_SHOT_KEYWORDS.some(kw => brief.toLowerCase().includes(kw))
  if (isProductShot) {
    try {
      const bgResult = await removeBackground(currentUrl)
      if (bgResult.success) {
        currentUrl = bgResult.url
        applied.push('remove_background')
      }
    } catch (err) {
      console.warn('[Orchestra] Background removal failed, continuing without:', err instanceof Error ? err.message : err)
    }
  }

  if (applied.length === 0) return undefined

  return {
    applied,
    before_url: beforeUrl,
    after_url: currentUrl,
  }
}

// ============================================================================
// A/B Testing
// ============================================================================

function selectABTestGroup(): 'A' | 'B' {
  return Math.random() < 0.5 ? 'A' : 'B'
}

function getABTestProvider(
  scores: { provider: string; score: number }[],
  group: 'A' | 'B',
): string | undefined {
  // A = top provider, B = second provider (if available)
  if (scores.length < 2) return undefined
  return group === 'A' ? scores[0].provider : scores[1].provider
}

// ============================================================================
// Core Orchestration
// ============================================================================

/**
 * Orchestrate content creation across all providers.
 *
 * This is the single entry point for the Content Orchestra. It:
 * 1. Generates text content via Claude
 * 2. Generates image via the smart image router (with fallbacks)
 * 3. Generates video via the smart video router (with fallbacks)
 * 4. Generates audio via ElevenLabs
 * 5. Applies post-processing enhancements
 * 6. Validates quality at each step
 * 7. Tracks provider performance and costs
 */
export async function orchestrateContent(request: OrchestraRequest): Promise<OrchestraResult> {
  const {
    brief,
    brandId,
    platforms,
    contentTypes,
    style,
    urgency = 'draft',
    budget = 'medium',
    abTest = false,
    userId,
    imageAspectRatio = '1:1',
    audioStyle = 'voiceover',
    videoFromImage = false,
  } = request

  const providerBreakdown: OrchestraProviderBreakdown[] = []
  const warnings: string[] = []
  let totalCost = 0
  let overallQualityScore = 0
  let qualityChecks = 0

  let textResult: OrchestraTextResult | undefined
  let imageResult: OrchestraImageResult | undefined
  let videoResult: OrchestraVideoResult | undefined
  let audioResult: OrchestraAudioResult | undefined
  let postProcessingResult: OrchestraPostProcessingResult | undefined
  let abTestGroup: 'A' | 'B' | undefined

  // ── Step 1: Text Generation ──────────────────────────────────────────────
  if (contentTypes.includes('text') || contentTypes.includes('image') || contentTypes.includes('audio')) {
    const startTime = Date.now()
    try {
      const contentType = contentTypes.includes('video') ? 'video_script' as const
        : contentTypes.includes('image') ? 'image_caption' as const
        : 'text' as const

      const content = await generateContent({
        topic: brief,
        platforms,
        contentType,
        brandId,
        userId,
        tone: style,
      })

      const elapsedMs = Date.now() - startTime
      const cost = content.tokensUsed * TEXT_COST_PER_TOKEN

      // Build platform variants map
      const primaryPlatform = platforms[0]
      const primaryVariant = content.variants[primaryPlatform]

      textResult = {
        content: primaryVariant?.text || '',
        platform_variants: content.variants,
        contentPillar: content.contentPillar,
        engagementHooks: content.engagementHooks,
      }

      totalCost += cost

      providerBreakdown.push({
        provider: 'claude',
        type: 'text',
        time_ms: elapsedMs,
        cost,
        success: true,
      })

      await logProviderPerformance({
        provider: 'claude',
        content_type: 'text',
        success: true,
        generation_time_ms: elapsedMs,
        estimated_cost: cost,
        was_fallback: false,
      })

      // Quality gate: validate text
      const textQuality = validateTextQuality(textResult.content, platforms)
      overallQualityScore += textQuality.score
      qualityChecks++
      warnings.push(...textQuality.warnings)

    } catch (err) {
      const elapsedMs = Date.now() - startTime
      const errorMsg = err instanceof Error ? err.message : 'Text generation failed'
      warnings.push(`Text generation failed: ${errorMsg}`)

      providerBreakdown.push({
        provider: 'claude',
        type: 'text',
        time_ms: elapsedMs,
        cost: 0,
        success: false,
        error: errorMsg,
      })
    }
  }

  // ── Step 2: Image Generation ─────────────────────────────────────────────
  if (contentTypes.includes('image') || (contentTypes.includes('video') && videoFromImage)) {
    // Determine if we should A/B test
    if (abTest) {
      abTestGroup = selectABTestGroup()
    }

    const imagePrompt = textResult?.platform_variants[platforms[0]]?.suggestedMedia
      || `Professional social media image for: ${brief}`

    // Get provider scores for potential A/B test override
    const imageScores = scoreImageProviders({ prompt: imagePrompt })

    // Determine preferred provider based on budget + A/B test
    let preferredProvider: ImageProvider = 'auto'
    if (abTestGroup && imageScores.length >= 2) {
      const abProvider = getABTestProvider(
        imageScores.map(s => ({ provider: s.provider, score: s.score })),
        abTestGroup,
      )
      if (abProvider) {
        preferredProvider = abProvider as ImageProvider
      }
    } else if (budget !== 'medium') {
      // Budget-driven provider preference
      const budgetPrefs = BUDGET_IMAGE_PREFERENCES[budget]
      // Pick the first budget-preferred provider that has a decent score
      for (const pref of budgetPrefs) {
        const scoreEntry = imageScores.find(s => s.provider === pref)
        if (scoreEntry && scoreEntry.score > 20) {
          preferredProvider = pref
          break
        }
      }
    }

    // Try with fallbacks
    const providerOrder = preferredProvider !== 'auto'
      ? [preferredProvider, ...BUDGET_IMAGE_PREFERENCES[budget].filter(p => p !== preferredProvider)]
      : BUDGET_IMAGE_PREFERENCES[budget]

    let imageSuccess = false
    for (const provider of providerOrder) {
      // Skip providers with high failure rates (> 50%)
      if (getFailureRate(provider, 'image') > 0.5) {
        warnings.push(`Skipping ${provider} for image — high failure rate`)
        continue
      }

      const startTime = Date.now()
      const wasFallback = provider !== providerOrder[0]

      try {
        const result = await smartGenerateImage({
          prompt: imagePrompt,
          aspectRatio: imageAspectRatio,
          preferredProvider: provider,
          needsHighRes: platforms.some(p => HIGH_RES_PLATFORMS.has(p)),
        })

        const elapsedMs = Date.now() - startTime
        const cost = IMAGE_COSTS[result.provider] || 0.05

        imageResult = {
          url: result.url,
          provider: result.provider,
          enhanced: !!result.enhancedPrompt,
          cost,
        }

        totalCost += cost
        recordProviderAttempt(result.provider, 'image', true)

        providerBreakdown.push({
          provider: result.provider,
          type: 'image',
          time_ms: elapsedMs,
          cost,
          success: true,
        })

        await logProviderPerformance({
          provider: result.provider,
          content_type: 'image',
          success: true,
          generation_time_ms: elapsedMs,
          estimated_cost: cost,
          was_fallback: wasFallback,
          ab_test_group: abTestGroup,
        })

        // Quality gate: validate image
        const imageQuality = validateImageQuality(result.url, platforms)
        overallQualityScore += imageQuality.score
        qualityChecks++
        warnings.push(...imageQuality.warnings)

        if (wasFallback) {
          warnings.push(`Image: fell back from ${providerOrder[0]} to ${result.provider}`)
        }

        imageSuccess = true
        break

      } catch (err) {
        const elapsedMs = Date.now() - startTime
        const errorMsg = err instanceof Error ? err.message : 'Image generation failed'
        recordProviderAttempt(provider, 'image', false)

        providerBreakdown.push({
          provider,
          type: 'image',
          time_ms: elapsedMs,
          cost: 0,
          success: false,
          error: errorMsg,
        })

        await logProviderPerformance({
          provider,
          content_type: 'image',
          success: false,
          generation_time_ms: elapsedMs,
          estimated_cost: 0,
          was_fallback: wasFallback,
          ab_test_group: abTestGroup,
        })

        console.warn(`[Orchestra] Image provider ${provider} failed:`, errorMsg)
      }
    }

    if (!imageSuccess) {
      warnings.push('All image providers failed — no image generated')
    }
  }

  // ── Step 3: Video Generation ─────────────────────────────────────────────
  if (contentTypes.includes('video')) {
    const videoPrompt = textResult?.platform_variants[platforms[0]]?.suggestedMedia
      || `Professional social media video for: ${brief}`

    // Budget-driven provider selection
    const videoProviderOrder = BUDGET_VIDEO_PREFERENCES[budget]

    let videoSuccess = false
    for (const provider of videoProviderOrder) {
      if (getFailureRate(provider, 'video') > 0.5) {
        warnings.push(`Skipping ${provider} for video — high failure rate`)
        continue
      }

      const startTime = Date.now()
      const wasFallback = provider !== videoProviderOrder[0]

      try {
        const result = await generateVideoWithProvider(
          provider as 'seedance' | 'minimax' | 'ltx',
          videoPrompt,
          videoFromImage && imageResult ? imageResult.url : undefined,
        )

        const elapsedMs = Date.now() - startTime
        const cost = VIDEO_COSTS[result.provider] || 0.50

        videoResult = {
          url: result.url,
          provider: result.provider,
          duration: result.durationSeconds || 5,
          cost,
        }

        totalCost += cost
        recordProviderAttempt(result.provider, 'video', true)

        providerBreakdown.push({
          provider: result.provider,
          type: 'video',
          time_ms: elapsedMs,
          cost,
          success: true,
        })

        await logProviderPerformance({
          provider: result.provider,
          content_type: 'video',
          success: true,
          generation_time_ms: elapsedMs,
          estimated_cost: cost,
          was_fallback: wasFallback,
        })

        if (wasFallback) {
          warnings.push(`Video: fell back from ${videoProviderOrder[0]} to ${result.provider}`)
        }

        // Basic quality score for video
        overallQualityScore += 80
        qualityChecks++

        videoSuccess = true
        break

      } catch (err) {
        const elapsedMs = Date.now() - startTime
        const errorMsg = err instanceof Error ? err.message : 'Video generation failed'
        recordProviderAttempt(provider, 'video', false)

        providerBreakdown.push({
          provider,
          type: 'video',
          time_ms: elapsedMs,
          cost: 0,
          success: false,
          error: errorMsg,
        })

        await logProviderPerformance({
          provider,
          content_type: 'video',
          success: false,
          generation_time_ms: elapsedMs,
          estimated_cost: 0,
          was_fallback: wasFallback,
        })

        console.warn(`[Orchestra] Video provider ${provider} failed:`, errorMsg)
      }
    }

    if (!videoSuccess) {
      warnings.push('All video providers failed — no video generated')
    }
  }

  // ── Step 4: Audio Generation ─────────────────────────────────────────────
  if (contentTypes.includes('audio')) {
    const audioText = textResult?.content
    if (!audioText) {
      warnings.push('Audio requested but no text content available — skipping audio')
    } else {
      const startTime = Date.now()
      try {
        const result = await smartGenerateAudio({
          text: audioText,
          brandId,
          style: audioStyle,
        }, userId)

        const elapsedMs = Date.now() - startTime
        const cost = audioText.length * AUDIO_COST_PER_CHAR

        audioResult = {
          url: result.url,
          voice: result.voiceName,
          duration: result.durationEstimate || 0,
          cost,
        }

        totalCost += cost
        recordProviderAttempt('elevenlabs', 'audio', true)

        providerBreakdown.push({
          provider: 'elevenlabs',
          type: 'audio',
          time_ms: elapsedMs,
          cost,
          success: true,
        })

        await logProviderPerformance({
          provider: 'elevenlabs',
          content_type: 'audio',
          success: true,
          generation_time_ms: elapsedMs,
          estimated_cost: cost,
          was_fallback: false,
        })

        overallQualityScore += 85
        qualityChecks++

      } catch (err) {
        const elapsedMs = Date.now() - startTime
        const errorMsg = err instanceof Error ? err.message : 'Audio generation failed'
        warnings.push(`Audio generation failed: ${errorMsg}`)
        recordProviderAttempt('elevenlabs', 'audio', false)

        providerBreakdown.push({
          provider: 'elevenlabs',
          type: 'audio',
          time_ms: elapsedMs,
          cost: 0,
          success: false,
          error: errorMsg,
        })

        await logProviderPerformance({
          provider: 'elevenlabs',
          content_type: 'audio',
          success: false,
          generation_time_ms: elapsedMs,
          estimated_cost: 0,
          was_fallback: false,
        })
      }
    }
  }

  // ── Step 5: Post-Processing Enhancement ──────────────────────────────────
  if (imageResult && !contentTypes.includes('video')) {
    // Only enhance static images (not video source frames)
    postProcessingResult = await maybeEnhanceImage(
      imageResult.url,
      platforms,
      brief,
      budget,
    )

    if (postProcessingResult) {
      // Update image URL to the enhanced version
      imageResult.url = postProcessingResult.after_url
      imageResult.enhanced = true
    }
  }

  // ── Compute Final Quality Score ──────────────────────────────────────────
  const finalQualityScore = qualityChecks > 0
    ? Math.round(overallQualityScore / qualityChecks)
    : 0

  return {
    text: textResult,
    image: imageResult,
    video: videoResult,
    audio: audioResult,
    postProcessing: postProcessingResult,
    totalCost: Math.round(totalCost * 1000) / 1000,
    qualityScore: finalQualityScore,
    providerBreakdown,
    abTestGroup,
    warnings,
  }
}

// ============================================================================
// Provider Performance Report
// ============================================================================

/**
 * Get a performance report for all providers over a given time range.
 */
export async function getProviderPerformanceReport(
  options: { days?: number; contentType?: string } = {},
): Promise<ProviderPerformanceReport[]> {
  const { days = 30, contentType } = options
  const supabase = getSupabase()

  const since = new Date()
  since.setDate(since.getDate() - days)

  let query = supabase
    .from('provider_performance')
    .select('*')
    .gte('created_at', since.toISOString())

  if (contentType) {
    query = query.eq('content_type', contentType)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Orchestra] Failed to fetch performance data:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Aggregate by provider + content_type
  const grouped = new Map<string, ProviderPerformanceRecord[]>()
  for (const row of data) {
    const key = `${row.provider}:${row.content_type}`
    const existing = grouped.get(key) || []
    existing.push(row)
    grouped.set(key, existing)
  }

  const reports: ProviderPerformanceReport[] = []
  for (const [, records] of grouped) {
    const first = records[0]
    const successCount = records.filter(r => r.success).length
    const failureCount = records.length - successCount
    const totalTime = records.reduce((sum, r) => sum + (r.generation_time_ms || 0), 0)
    const totalCostVal = records.reduce((sum, r) => sum + (r.estimated_cost || 0), 0)

    reports.push({
      provider: first.provider,
      content_type: first.content_type,
      total_requests: records.length,
      success_count: successCount,
      failure_count: failureCount,
      success_rate: records.length > 0 ? successCount / records.length : 0,
      avg_generation_time_ms: records.length > 0 ? Math.round(totalTime / records.length) : 0,
      total_cost: Math.round(totalCostVal * 1000) / 1000,
      avg_cost: records.length > 0 ? Math.round((totalCostVal / records.length) * 1000) / 1000 : 0,
    })
  }

  // Sort by total requests descending
  reports.sort((a, b) => b.total_requests - a.total_requests)

  return reports
}

// ============================================================================
// Spend Report
// ============================================================================

/**
 * Get a cost breakdown for a given period.
 */
export async function getSpendReport(
  period: 'day' | 'week' | 'month' = 'month',
): Promise<SpendReport> {
  const supabase = getSupabase()

  const since = new Date()
  if (period === 'day') since.setDate(since.getDate() - 1)
  else if (period === 'week') since.setDate(since.getDate() - 7)
  else since.setDate(since.getDate() - 30)

  const { data, error } = await supabase
    .from('provider_performance')
    .select('provider, content_type, estimated_cost')
    .gte('created_at', since.toISOString())
    .eq('success', true)

  if (error) {
    console.error('[Orchestra] Failed to fetch spend data:', error)
    return { period, total_cost: 0, by_provider: [], by_content_type: [] }
  }

  if (!data || data.length === 0) {
    return { period, total_cost: 0, by_provider: [], by_content_type: [] }
  }

  let totalCostVal = 0
  const byProvider = new Map<string, { cost: number; count: number }>()
  const byContentType = new Map<string, { cost: number; count: number }>()

  for (const row of data) {
    const cost = row.estimated_cost || 0
    totalCostVal += cost

    const provEntry = byProvider.get(row.provider) || { cost: 0, count: 0 }
    provEntry.cost += cost
    provEntry.count++
    byProvider.set(row.provider, provEntry)

    const ctEntry = byContentType.get(row.content_type) || { cost: 0, count: 0 }
    ctEntry.cost += cost
    ctEntry.count++
    byContentType.set(row.content_type, ctEntry)
  }

  return {
    period,
    total_cost: Math.round(totalCostVal * 1000) / 1000,
    by_provider: Array.from(byProvider.entries())
      .map(([provider, data]) => ({
        provider,
        cost: Math.round(data.cost * 1000) / 1000,
        count: data.count,
      }))
      .sort((a, b) => b.cost - a.cost),
    by_content_type: Array.from(byContentType.entries())
      .map(([content_type, data]) => ({
        content_type,
        cost: Math.round(data.cost * 1000) / 1000,
        count: data.count,
      }))
      .sort((a, b) => b.cost - a.cost),
  }
}
