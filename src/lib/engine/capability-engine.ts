/**
 * Capability-Aware Engine (rung E0)
 *
 * A THIN capability-first layer OVER the existing per-modality routers
 * (image-router / video-router / audio-router) and the U0 Higgsfield provider.
 * It does NOT rewrite the routers — it reuses their adapters.
 *
 * The orchestrator stops asking "which provider?" and asks "which capability?".
 * This module resolves a CapabilityRequest → a concrete (engine, model, tool)
 * Plan (resolvePlan), then runs it with a fallback cascade (executeWithCascade):
 *   Higgsfield primary → FAL fallback on transient error/timeout/unavailable.
 *
 * Design (authoritative): docs/01-CAPABILITY-ENGINE-RESPEC.md §3-4 and
 * docs/_brain_outputs/capability-catalog.md (model ids / defaults per tier).
 *
 * ZERO-BEHAVIOR-CHANGE GATE (§5.5): with HIGGSFIELD_API_KEY absent AND
 * engineDefaultMediaEngine unset ('auto') AND enginePruneLegacyMedia=false, the
 * image/video selection MUST match today's pickProvider()/pickVideoProvider()
 * output byte-for-byte. The legacy routers stay the source of truth in that case.
 *
 * Fail-soft ladder (§4.3) for Higgsfield-ONLY (no-fallback) capabilities:
 *   1. DNA present + HF up        → premium (normal path)
 *   2. DNA present + breaker OPEN → queue (generation_jobs status queued_engine_down)
 *   3. DNA absent                 → degrade-with-flag (meta.degraded='no_soul'), NEVER fake identity
 *   4. intelligence (virality/analysis) + HF down → skip the gate, don't block publish
 */

import { getConfig } from './config'
import {
  smartGenerateImage,
  scoreProviders,
  pickProvider,
} from './image-router'
import { higgsfieldGenerateImage, HiggsfieldError } from './providers/higgsfield'
import {
  smartGenerateVideo,
  scoreVideoProviders,
  pickVideoProvider,
} from './video-router'
import { smartGenerateAudio } from './audio-router'
import { recordGenerationJob } from './brand'
import type { SoulStorage } from './brand'
import {
  estimateCredits as estimateBudgetCredits,
  checkBudget,
  type DailySpendReader,
  type BudgetDecision,
} from './budget'
import type {
  Capability,
  CapabilityRequest,
  CapabilityResult,
  CapabilityPlan,
  CapabilityFailSoft,
  CapabilityResolution,
  EngineId,
  EngineDescriptor,
  QualityTier,
  GenerationMeta,
  GenerationJobMediaType,
} from './types'

// ============================================================================
// ENGINE REGISTRY (§3.1) — providers re-cast as engines + capability support
// Model ids per capability come from docs/_brain_outputs/capability-catalog.md.
// ============================================================================

export const ENGINE_REGISTRY: Record<EngineId, EngineDescriptor> = {
  higgsfield: {
    id: 'higgsfield',
    role: 'media-primary',
    availabilityRisk: 'high', // single supplier; REST surface unknown for soul/ms/virality
    healthKey: 'higgsfield',
    supports: [
      'image_gen', 'video_gen',
      'persona_consistent_image', 'persona_consistent_video',
      'brand_kit_image', 'ad_reference_video', 'marketing_studio_video',
      'preset_i2v', 'reframe', 'outpaint', 'upscale', 'remove_bg',
      'video_analysis', 'virality_predict', 'image_to_3d',
      'audio_tts', 'audio_music', 'audio_sfx',
    ],
    models: {
      image_gen: 'nano_banana_pro',
      persona_consistent_image: 'soul_2',
      brand_kit_image: 'ms_image',
      video_gen: 'seedance_2_0',
      persona_consistent_video: 'seedance_2_0',
      ad_reference_video: 'marketing_studio_video',
      marketing_studio_video: 'marketing_studio_video',
      preset_i2v: 'higgsfield_preset',
      image_to_3d: 'image_to_3d',
      audio_tts: 'inworld_text_to_speech',
      audio_music: 'sonilo_music',
      audio_sfx: 'mirelo_text_to_audio',
    },
  },
  fal: {
    id: 'fal',
    role: 'media-fallback',
    availabilityRisk: 'low',
    healthKey: 'fal',
    supports: ['image_gen', 'video_gen'],
    models: {
      image_gen: 'flux/schnell',
      video_gen: 'seedance', // FAL video-router selects flux/seedance/kling/ltx internally
    },
  },
  elevenlabs: {
    id: 'elevenlabs',
    role: 'audio',
    availabilityRisk: 'low',
    healthKey: 'elevenlabs',
    supports: ['audio_tts'],
    models: { audio_tts: 'eleven_multilingual_v2' },
  },
  anthropic: {
    id: 'anthropic',
    role: 'text-primary',
    availabilityRisk: 'low',
    healthKey: 'anthropic',
    supports: ['text_gen'],
    models: { text_gen: 'claude-sonnet-4-20250514' },
  },
  openai: {
    id: 'openai',
    role: 'text-fallback',
    availabilityRisk: 'low',
    healthKey: 'openai',
    supports: ['text_gen'],
    models: { text_gen: 'gpt-4o' },
  },
}

/** Capabilities with NO reliability fallback — Higgsfield-ONLY (§3.3). */
const HIGGSFIELD_ONLY: ReadonlySet<Capability> = new Set<Capability>([
  'persona_consistent_image', 'persona_consistent_video',
  'brand_kit_image', 'ad_reference_video', 'marketing_studio_video',
  'reframe', 'outpaint', 'upscale', 'remove_bg',
  'video_analysis', 'virality_predict', 'image_to_3d',
  'audio_music', 'audio_sfx',
])

/** Brand-DNA-bound capabilities — require a soulId/brandKitStyleId to be on-brand (§4.3). */
const BRAND_DNA_BOUND: ReadonlySet<Capability> = new Set<Capability>([
  'persona_consistent_image', 'persona_consistent_video', 'brand_kit_image',
])

/** Pure-intelligence capabilities — must never block publish if engine down (§4.3 step 4). */
const INTELLIGENCE: ReadonlySet<Capability> = new Set<Capability>([
  'virality_predict', 'video_analysis',
])

export function isHiggsfieldOnly(c: Capability): boolean { return HIGGSFIELD_ONLY.has(c) }
export function isBrandDnaBound(c: Capability): boolean { return BRAND_DNA_BOUND.has(c) }
export function isIntelligence(c: Capability): boolean { return INTELLIGENCE.has(c) }

function mediaTypeFor(c: Capability): GenerationJobMediaType | undefined {
  if (c === 'video_gen' || c === 'persona_consistent_video' || c === 'ad_reference_video'
    || c === 'marketing_studio_video' || c === 'preset_i2v') return 'video'
  if (c === 'audio_tts' || c === 'audio_music' || c === 'audio_sfx') return 'audio'
  if (c === 'image_to_3d') return '3d'
  if (c === 'image_gen' || c === 'persona_consistent_image' || c === 'brand_kit_image'
    || c === 'reframe' || c === 'outpaint' || c === 'upscale' || c === 'remove_bg') return 'image'
  return undefined
}

// ============================================================================
// CIRCUIT BREAKER (§4.4) — per-engine, in-memory, injectable clock for tests.
// N consecutive transient failures → OPEN for a cooldown → half-open probe.
// ============================================================================

const DEFAULT_BREAKER_THRESHOLD = 5
const DEFAULT_BREAKER_COOLDOWN_MS = 5 * 60_000

interface BreakerState {
  consecutiveFailures: number
  openedAt: number | null
}

class CircuitBreaker {
  private states = new Map<string, BreakerState>()
  now: () => number = () => Date.now()

  private cfg() {
    const c = getConfig()
    return {
      threshold: c.engineBreakerThreshold ?? DEFAULT_BREAKER_THRESHOLD,
      cooldown: c.engineBreakerCooldownMs ?? DEFAULT_BREAKER_COOLDOWN_MS,
    }
  }

  private get(key: string): BreakerState {
    let s = this.states.get(key)
    if (!s) { s = { consecutiveFailures: 0, openedAt: null }; this.states.set(key, s) }
    return s
  }

  /** Closed = available. Half-open (cooldown elapsed) also returns true (probe allowed). */
  isClosed(key: string): boolean {
    const s = this.get(key)
    if (s.openedAt === null) return true
    const { cooldown } = this.cfg()
    if (this.now() - s.openedAt >= cooldown) return true // half-open probe
    return false
  }

  record(key: string, transient: boolean): void {
    const s = this.get(key)
    if (!transient) { return } // only transient errors count toward tripping
    s.consecutiveFailures++
    const { threshold } = this.cfg()
    if (s.consecutiveFailures >= threshold) s.openedAt = this.now()
  }

  recordSuccess(key: string): void {
    const s = this.get(key)
    s.consecutiveFailures = 0
    s.openedAt = null
  }

  /** Test/maintenance hook. */
  reset(): void { this.states.clear() }
  /** Force a breaker OPEN (used by contract tests to simulate HF down). */
  forceOpen(key: string): void { this.get(key).openedAt = this.now() }
}

export const circuitBreaker = new CircuitBreaker()

// ============================================================================
// TRANSIENT-ERROR CLASSIFICATION (§4.4) — what is safe to cascade/retry.
// ============================================================================

const HF_TRANSIENT_CODES = new Set([
  'HF_SUBMIT_FAILED', 'HF_POLL_FAILED', 'HF_TIMEOUT',
])

export function isTransientError(err: unknown): boolean {
  if (err instanceof HiggsfieldError) {
    if (err.code === 'HF_NO_KEY') return false // not transient — engine simply not configured
    if (HF_TRANSIENT_CODES.has(err.code)) return true
    if (typeof err.status === 'number' && (err.status === 429 || err.status >= 500)) return true
    return false
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return /timeout|timed out|rate limit|429|50\d|temporarily|unavailable|econnreset|network/.test(msg)
}

// ============================================================================
// CREDIT ESTIMATION (§4.2 step 4) — coarse per-(engine,capability,tier).
// Numbers are [A] estimates from capability-catalog.md; refined with a live key.
// ============================================================================

const TIER_MULTIPLIER: Record<QualityTier, number> = { draft: 0.4, standard: 1, premium: 2 }

const BASE_CREDITS: Partial<Record<Capability, number>> = {
  image_gen: 2, persona_consistent_image: 2, brand_kit_image: 2,
  video_gen: 6, persona_consistent_video: 6, marketing_studio_video: 6,
  ad_reference_video: 6, preset_i2v: 6,
  reframe: 1, outpaint: 2, upscale: 1, remove_bg: 1,
  video_analysis: 2, virality_predict: 2, image_to_3d: 3,
  audio_tts: 1, audio_music: 2, audio_sfx: 1,
}

export function estimateCredits(engine: EngineId, capability: Capability, tier: QualityTier): number {
  // FAL commodity lane is ~free in credits (billed in $ separately); treat as cheap.
  if (engine === 'fal') return 0.5 * TIER_MULTIPLIER[tier]
  const base = BASE_CREDITS[capability] ?? 2
  return base * TIER_MULTIPLIER[tier]
}

// ============================================================================
// RESOLUTION (§4.2) — capability → concrete (engine, model, tool) Plan.
// ============================================================================

function hasRequiredDNA(req: CapabilityRequest): boolean {
  const dna = req.brandDNA
  if (!dna) return false
  if (req.capability === 'brand_kit_image') return !!dna.brandKitStyleId
  // persona_consistent_*
  return !!dna.soulId
}

/** True when Higgsfield is configured AND opted-in as the media default. */
function higgsfieldEnabledForMedia(): boolean {
  const c = getConfig()
  return !!c.higgsfieldApiKey && c.engineDefaultMediaEngine === 'higgsfield'
}

function toolFor(capability: Capability): string | undefined {
  switch (capability) {
    case 'reframe': return 'reframe'
    case 'outpaint': return 'outpaint_image'
    case 'upscale': return 'upscale_image'
    case 'remove_bg': return 'remove_background'
    case 'virality_predict': return 'virality_predictor'
    case 'video_analysis': return 'video_analysis'
    default: return undefined
  }
}

function plan(
  engine: EngineId,
  capability: Capability,
  tier: QualityTier,
  fallbacks: EngineId[],
  routingScore = 0,
): CapabilityPlan {
  return {
    engine,
    model: ENGINE_REGISTRY[engine].models[capability],
    tool: toolFor(capability),
    estCredits: estimateCredits(engine, capability, tier),
    qualityTier: tier,
    fallbacks,
    routingScore,
  }
}

/**
 * Resolve a CapabilityRequest into a runnable plan or a fail-soft outcome.
 * Pure & synchronous (no network) — the contract tests exercise it directly.
 */
export function resolvePlan(req: CapabilityRequest): CapabilityResolution {
  const capability = req.capability
  const tier: QualityTier = req.qualityTier ?? 'standard'

  // 0. candidate engines that SUPPORT this capability, ordered by role precedence.
  const candidates = (Object.values(ENGINE_REGISTRY) as EngineDescriptor[])
    .filter((e) => e.supports.includes(capability))
    .sort((a, b) => rolePrecedence(a.role) - rolePrecedence(b.role))

  // 1a. brand-DNA binding: persona/brand-kit MUST have the required DNA, else fail-soft ladder.
  if (isBrandDnaBound(capability) && !hasRequiredDNA(req)) {
    // step 3: degrade-with-flag → route to the generic gen capability + text context.
    const degradeCap: Capability = capability === 'brand_kit_image' ? 'image_gen'
      : capability === 'persona_consistent_video' ? 'video_gen' : 'image_gen'
    const degradeReq: CapabilityRequest = { ...req, capability: degradeCap, brandDNA: undefined }
    const degradeRes = resolvePlan(degradeReq)
    const degradePlan = 'failSoft' in degradeRes ? undefined : degradeRes
    return { failSoft: true, reason: 'no_soul', degradePlan }
  }

  // 1b. explicit escape hatch.
  let live = req.preferredEngine
    ? candidates.filter((e) => e.id === req.preferredEngine)
    : candidates

  // 2. availability filter (circuit breaker): drop engines whose breaker is OPEN.
  live = live.filter((e) => circuitBreaker.isClosed(e.healthKey))

  if (live.length === 0) {
    // No live engine. Intelligence → skip the gate; DNA-bound → queue; else over_budget-ish fail.
    if (isIntelligence(capability)) return { failSoft: true, reason: 'gate_skipped' }
    if (isBrandDnaBound(capability) || isHiggsfieldOnly(capability)) {
      return { failSoft: true, reason: 'queued_engine_down' }
    }
    return { failSoft: true, reason: 'over_budget' }
  }

  // 3. quality-tier + budget selection among live engines.
  const fal = live.find((e) => e.id === 'fal')
  const primary = live[0] // highest role precedence among live
  let engine: EngineDescriptor

  // ZERO-BEHAVIOR-CHANGE: for the generic media capabilities, when HF is NOT the
  // opted-in default, defer to the legacy router's pick (so selection is identical
  // to today). resolvePlan still returns a plan, but executeWithCascade routes
  // through the unchanged smartGenerate* path.
  const mediaGeneric = capability === 'image_gen' || capability === 'video_gen'
  if (mediaGeneric && !higgsfieldEnabledForMedia()) {
    // Legacy path: let the router decide (fal or whatever default). Use 'fal' as the
    // nominal plan engine but mark it so execute routes through the legacy router.
    const legacyEngine = fal ?? primary
    const p = plan(legacyEngine.id, capability, tier, [], 0)
    return p
  }

  if (tier === 'draft' && !isBrandDnaBound(capability) && fal && fal.supports.includes(capability)) {
    engine = fal // draft → cheapest engine (FAL) unless DNA-bound
  } else {
    engine = primary // standard/premium → Higgsfield primary
  }

  // 4. budget ceiling: estimate credits; downgrade a tier or fail-soft if over.
  const est = estimateCredits(engine.id, capability, tier)
  const ceiling = req.budget?.creditCeiling
  if (ceiling !== undefined && est > ceiling) {
    if (tier === 'premium') return resolvePlan({ ...req, qualityTier: 'standard' })
    if (tier === 'standard') return resolvePlan({ ...req, qualityTier: 'draft' })
    return { failSoft: true, reason: 'over_budget' }
  }

  // 5. fallback ordering: the remaining live engines (e.g. FAL after Higgsfield),
  //    excluding the chosen primary, and excluding fallbacks for HF-only capabilities.
  const fallbacks: EngineId[] = isHiggsfieldOnly(capability)
    ? []
    : live.filter((e) => e.id !== engine.id).map((e) => e.id)

  return plan(engine.id, capability, tier, fallbacks, est)
}

function rolePrecedence(role: EngineDescriptor['role']): number {
  switch (role) {
    case 'media-primary': return 0
    case 'media-fallback': return 1
    case 'audio': return 0
    case 'text-primary': return 0
    case 'text-fallback': return 1
  }
}

// ============================================================================
// EXECUTION (§4.4) — run a plan, cascade to FAL on transient error/timeout.
// Reuses the EXISTING adapters; adds no new HTTP except via providers/higgsfield.
// ============================================================================

async function runOnEngine(
  engine: EngineId,
  req: CapabilityRequest,
  modelId: string | undefined,
): Promise<{ url?: string; provider: EngineId; model?: string; durationSeconds?: number }> {
  const capability = req.capability
  const aspect = req.format?.aspectRatio ?? '1:1'
  const prompt = req.prompt ?? ''

  // ----- Higgsfield lane -----
  if (engine === 'higgsfield') {
    // IMAGE generation capabilities run through the U0 provider (image lane exists today).
    if (capability === 'image_gen' || capability === 'persona_consistent_image' || capability === 'brand_kit_image') {
      // Thread persist through (default true in prod; CLI proofs pass false so the
      // proof never depends on Supabase). A persist failure can NEVER fail the gen.
      const img = await higgsfieldGenerateImage(prompt, aspect, { model: modelId, persist: req.persist })
      return { url: img.url, provider: 'higgsfield', model: modelId }
    }
    // VIDEO/AUDIO/intelligence/post-proc HF lanes are LATER rungs (provider not built
    // yet). Route VIDEO through the existing FAL path unchanged for now; signal others.
    if (capability === 'video_gen' || capability === 'persona_consistent_video') {
      const vid = await smartGenerateVideo({ prompt, imageUrl: req.inputs?.imageUrl })
      return { url: vid.url, provider: 'fal', model: vid.model, durationSeconds: vid.durationSeconds }
    }
    // No HF lane wired yet for this capability → throw a non-transient marker so the
    // ladder (queue/skip) handles it rather than a bogus cascade.
    throw new HiggsfieldError('HF_NO_OUTPUT', `Higgsfield lane for '${capability}' not wired yet (later rung)`)
  }

  // ----- FAL lane (fallback + commodity draft) -----
  if (engine === 'fal') {
    if (capability === 'image_gen') {
      const img = await smartGenerateImage({ prompt, aspectRatio: aspect as '1:1', preferredProvider: 'fal' })
      return { url: img.url, provider: 'fal', model: 'fal' }
    }
    if (capability === 'video_gen' || capability === 'persona_consistent_video') {
      const vid = await smartGenerateVideo({ prompt, imageUrl: req.inputs?.imageUrl, preferredProvider: 'auto' })
      return { url: vid.url, provider: 'fal', model: vid.model, durationSeconds: vid.durationSeconds }
    }
  }

  // ----- ElevenLabs (audio) -----
  if (engine === 'elevenlabs' && capability === 'audio_tts') {
    const audio = await smartGenerateAudio({ text: prompt, style: req.audioStyle ?? 'voiceover' }, req.userId)
    return { url: audio.url, provider: 'elevenlabs', model: audio.provider }
  }

  throw new Error(`No adapter for engine='${engine}' capability='${capability}'`)
}

/**
 * Run the legacy (zero-behavior-change) media path for generic image/video gen.
 * This is the byte-identical-to-today path: it calls the unchanged smartGenerate*
 * which internally uses pickProvider()/pickVideoProvider().
 */
async function runLegacyMedia(req: CapabilityRequest): Promise<{ url: string; provider: EngineId; model?: string; durationSeconds?: number }> {
  const aspect = req.format?.aspectRatio ?? '1:1'
  if (req.capability === 'image_gen') {
    const img = await smartGenerateImage({ prompt: req.prompt ?? '', aspectRatio: aspect as '1:1' })
    return { url: img.url, provider: img.provider as EngineId, model: img.provider }
  }
  const vid = await smartGenerateVideo({ prompt: req.prompt ?? '', imageUrl: req.inputs?.imageUrl })
  return { url: vid.url, provider: 'fal', model: vid.model, durationSeconds: vid.durationSeconds }
}

export interface ExecuteOptions {
  /** Injected storage for recordGenerationJob (tests pass a mock; prod uses default). */
  storage?: SoulStorage
  /** Skip the generation_jobs write (used by hermetic tests that don't assert it). */
  skipRecord?: boolean
  /** Injected prior-spend reader for the budget gate (tests pass a controllable mock). */
  spendReader?: DailySpendReader
  /** Injected clock for the budget gate (tests pin the UTC day). */
  now?: () => number
  /** Per-tenant daily-cap override (tier-based caps later). */
  dailyCapOverride?: number
}

/**
 * Execute a resolved plan with the fallback cascade, recording the job.
 * On transient error: cascade Higgsfield → FAL for fallback-eligible capabilities;
 * apply the fail-soft ladder for Higgsfield-ONLY capabilities.
 */
export async function executeWithCascade(
  resolution: CapabilityResolution,
  req: CapabilityRequest,
  opts: ExecuteOptions = {},
): Promise<CapabilityResult> {
  const capability = req.capability

  // --- fail-soft resolutions (no runnable primary) ---
  if ('failSoft' in resolution) {
    if (resolution.reason === 'no_soul' && resolution.degradePlan) {
      // step 3: degrade-with-flag. Run the degraded plan (generic gen, NO DNA), then
      // tag meta.degraded='no_soul' so the UI/autopilot knows identity is NOT locked.
      const degradeReq: CapabilityRequest = {
        ...req,
        capability: degradeCapFor(capability),
        brandDNA: undefined,
      }
      const result = await executeWithCascade(resolution.degradePlan, degradeReq, { ...opts, skipRecord: true })
      result.meta.degraded = 'no_soul'
      result.meta.capability = capability
      await record(req, result.meta, 'degraded_no_soul', opts)
      return result
    }
    if (resolution.reason === 'gate_skipped') {
      const meta: GenerationMeta = { engine: 'higgsfield', capability, gateSkipped: true, degraded: 'gate_skipped' }
      await record(req, meta, 'gate_skipped', opts)
      return { provider: 'higgsfield', meta }
    }
    if (resolution.reason === 'queued_engine_down') {
      const meta: GenerationMeta = { engine: 'higgsfield', capability, queued: true, degraded: 'queued_engine_down' }
      const job = await record(req, meta, 'queued_engine_down', opts)
      if (job) meta.jobId = job
      return { provider: 'higgsfield', meta }
    }
    // over_budget (no downgrade possible)
    const meta: GenerationMeta = { engine: 'fal', capability, degraded: 'over_budget' }
    await record(req, meta, 'over_budget', opts)
    return { provider: 'fal', meta }
  }

  const planEngine = resolution.engine
  const mediaGeneric = capability === 'image_gen' || capability === 'video_gen'

  // ========================================================================
  // CREDIT BUDGET GATE (rung B0) — sits BEFORE any provider dispatch.
  // Estimate the plan's credits → kill-switch + per-request ceiling + per-tenant
  // daily cap. On BLOCK: record a status='blocked' generation_jobs row (auditable)
  // and return a typed blocked result. A budget block means STOP — it must NOT
  // cascade to FAL. DEFAULT-SAFE: with nothing configured this ALWAYS allows
  // (today's behavior) and only logs the estimate.
  // ========================================================================
  const estCredits = estimateBudgetCredits({
    engine: planEngine,
    capability,
    model: resolution.model,
    qualityTier: resolution.qualityTier,
  })
  const decision = await checkBudget(req.userId, estCredits, {
    spendReader: opts.spendReader,
    now: opts.now,
    dailyCapOverride: opts.dailyCapOverride,
  })
  if (decision.blocked) {
    return blockedResult(req, planEngine, decision, opts)
  }
  // Default-safe logging: surface the estimate even when allowed (auditable trail).
  console.log(
    `[capability-engine] budget OK: capability='${capability}' est=${estCredits}cr` +
    `${decision.spentToday !== undefined ? ` spentToday=${decision.spentToday}cr` : ''}` +
    `${decision.limit !== undefined ? ` cap=${decision.limit}cr` : ' (uncapped)'}`,
  )

  // ZERO-BEHAVIOR-CHANGE legacy path: generic media when HF not opted-in.
  if (mediaGeneric && !higgsfieldEnabledForMedia()) {
    const out = await runLegacyMedia(req)
    const meta: GenerationMeta = {
      engine: out.provider, model: out.model, capability, routingScore: 0,
    }
    await record(req, meta, 'completed', opts)
    return { url: out.url, prompt: req.prompt, provider: out.provider, meta }
  }

  // --- primary attempt ---
  try {
    const out = await runOnEngine(planEngine, req, resolution.model)
    circuitBreaker.recordSuccess(ENGINE_REGISTRY[planEngine].healthKey)
    const meta: GenerationMeta = {
      engine: out.provider, model: out.model, tool: resolution.tool,
      capability, creditsSpent: resolution.estCredits, routingScore: resolution.routingScore,
      soulId: req.brandDNA?.soulId ?? null, brandKitStyleId: req.brandDNA?.brandKitStyleId ?? null,
    }
    await record(req, meta, 'completed', opts)
    return { url: out.url, prompt: req.prompt, provider: out.provider, meta }
  } catch (err) {
    const transient = isTransientError(err)
    // NEVER swallow the primary failure silently: log message + code + whether it is
    // classified transient BEFORE any cascade/fail-soft decision. This is the only
    // place that knows the real reason the primary engine failed; if the cascade then
    // 401s on the fallback, this line is the ground truth for what actually broke.
    const errCode = err instanceof HiggsfieldError ? err.code : undefined
    const errStatus = err instanceof HiggsfieldError ? err.status : undefined
    console.error(
      `[capability-engine] primary engine '${planEngine}' FAILED for capability '${capability}': ` +
      `${errMsg(err)}` +
      `${errCode ? ` [code=${errCode}]` : ''}` +
      `${errStatus !== undefined ? ` [status=${errStatus}]` : ''}` +
      ` (transient=${transient})`
    )
    circuitBreaker.record(ENGINE_REGISTRY[planEngine].healthKey, transient)

    // Higgsfield-ONLY capability → no engine fallback; queue or skip per ladder.
    if (isHiggsfieldOnly(capability)) {
      if (isIntelligence(capability)) {
        const meta: GenerationMeta = { engine: 'higgsfield', capability, gateSkipped: true, degraded: 'gate_skipped' }
        await record(req, meta, 'gate_skipped', opts)
        return { provider: 'higgsfield', meta }
      }
      const meta: GenerationMeta = { engine: 'higgsfield', capability, queued: true, degraded: 'queued_engine_down' }
      const job = await record(req, meta, 'queued_engine_down', opts, errMsg(err))
      if (job) meta.jobId = job
      return { provider: 'higgsfield', meta }
    }

    // Fallback-eligible: cascade to the next live engine (FAL) on transient error.
    if (transient && resolution.fallbacks.length > 0) {
      const fbEngine = resolution.fallbacks[0]
      console.warn(`[capability-engine] cascade: ${planEngine} → ${fbEngine} (${errMsg(err)})`)
      const out = await runOnEngine(fbEngine, req, ENGINE_REGISTRY[fbEngine].models[capability])
      circuitBreaker.recordSuccess(ENGINE_REGISTRY[fbEngine].healthKey)
      const meta: GenerationMeta = {
        engine: out.provider, model: out.model, capability,
        creditsSpent: estimateCredits(fbEngine, capability, resolution.qualityTier),
        routingScore: resolution.routingScore,
      }
      await record(req, meta, 'completed_fallback', opts)
      return { url: out.url, prompt: req.prompt, provider: out.provider, meta }
    }

    // Non-recoverable.
    throw err
  }
}

function degradeCapFor(capability: Capability): Capability {
  if (capability === 'persona_consistent_video') return 'video_gen'
  return 'image_gen'
}

/**
 * Build + record the FAIL-SAFE result for a budget-blocked generation.
 * Records an auditable generation_jobs row with status='blocked' + the reason, and
 * returns a typed result the caller surfaces as a degrade/skip. NEVER cascades to FAL
 * (a budget block means STOP, not reroute) and NEVER crashes the pipeline.
 */
async function blockedResult(
  req: CapabilityRequest,
  engine: EngineId,
  decision: BudgetDecision,
  opts: ExecuteOptions,
): Promise<CapabilityResult> {
  console.warn(
    `[capability-engine] BUDGET BLOCK: capability='${req.capability}' reason='${decision.reason}' ` +
    `est=${decision.estimatedCredits}cr — ${decision.message ?? 'blocked'} (NO provider call, NO cascade)`,
  )
  const meta: GenerationMeta = {
    engine,
    capability: req.capability,
    creditsSpent: 0, // blocked → nothing actually spent
    budgetBlocked: true,
    blockReason: decision.reason,
    degraded: 'over_budget',
  }
  const job = await record(req, meta, 'blocked', opts, decision.message)
  if (job) meta.jobId = job
  return { provider: engine, meta }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Record a generation_jobs row (best-effort — never throws into the gen path).
 * Returns the job id (when recorded) so callers can surface meta.jobId.
 */
async function record(
  req: CapabilityRequest,
  meta: GenerationMeta,
  status: string,
  opts: ExecuteOptions,
  error?: string,
): Promise<string | undefined> {
  if (opts.skipRecord || !req.userId) return undefined
  try {
    const job = await recordGenerationJob({
      userId: req.userId,
      brandSoulId: req.brandDNA?.brandSoulId ?? undefined,
      capability: req.capability,
      engine: meta.engine,
      tool: meta.tool ?? null,
      model: meta.model ?? null,
      mediaType: mediaTypeFor(req.capability) ?? null,
      status,
      params: {
        prompt: req.prompt,
        format: req.format,
        qualityTier: req.qualityTier ?? 'standard',
        degraded: meta.degraded ?? null,
      },
      resultUrl: meta.queued || meta.gateSkipped ? null : undefined,
      hfCreditsSpent: meta.creditsSpent ?? null,
      error: error ?? null,
      idempotencyKey: req.idempotencyKey ?? null,
    }, opts.storage)
    return job.id
  } catch (e) {
    console.warn('[capability-engine] recordGenerationJob failed (non-fatal):', errMsg(e))
    return undefined
  }
}

// ============================================================================
// PUBLIC ENTRY (§5.1) — the ONE surface the orchestrator calls.
// ============================================================================

/** Resolve + execute a capability request end-to-end. */
export async function runCapability(
  req: CapabilityRequest,
  opts: ExecuteOptions = {},
): Promise<CapabilityResult> {
  const resolution = resolvePlan(req)
  return executeWithCascade(resolution, req, opts)
}

// ============================================================================
// U3 ENTRY-POINT HELPER (§5.3) — brand-DNA-aware media generation.
//
// The single surface pipeline/orchestra/autopilot call to generate an image with
// brand DNA injected. It picks the right capability from the loaded BrandDNA:
//   - soulId present  → persona_consistent_image (HF soul_2, on-identity)
//   - brandKitStyleId → brand_kit_image          (HF ms_image, DTC)
//   - otherwise        → image_gen               (generic; legacy path when HF off)
//
// ZERO-BEHAVIOR-CHANGE: when dna is null (no brand_souls row) AND HF is not the
// opted-in media default, this routes 'image_gen' through the UNCHANGED legacy
// router — byte-identical to today. When dna has a soul but HF is down, the
// fail-soft ladder degrades-with-flag (never fakes identity) and still returns
// a usable image.
// ============================================================================

export interface BrandImageRequest {
  prompt: string
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
  platform?: import('./types').Platform
  qualityTier?: QualityTier
  userId?: string
  idempotencyKey?: string
  /** Resolved server-side from loadBrandDNA — the four hf_* bindings + brand soul id. */
  brandDNA?: import('./types').CapabilityBrandDNA
  /** Persist generated media to Supabase storage. Default true (production); CLI
   *  proofs pass false to drop the storage dependency (raw provider URL returned). */
  persist?: boolean
}

function imageCapabilityFor(dna?: import('./types').CapabilityBrandDNA): Capability {
  if (dna?.soulId) return 'persona_consistent_image'
  if (dna?.brandKitStyleId) return 'brand_kit_image'
  return 'image_gen'
}

/**
 * Generate an on-brand image through the capability engine. Returns the normalized
 * { url, meta } shape; callers keep their existing GeneratedImage consumers.
 */
export async function generateBrandImage(
  req: BrandImageRequest,
  opts: ExecuteOptions = {},
): Promise<CapabilityResult> {
  const capability = imageCapabilityFor(req.brandDNA)
  return runCapability(
    {
      capability,
      prompt: req.prompt,
      brandDNA: req.brandDNA,
      format: { aspectRatio: req.aspectRatio ?? '1:1', platform: req.platform },
      qualityTier: req.qualityTier ?? 'standard',
      userId: req.userId,
      idempotencyKey: req.idempotencyKey,
      persist: req.persist,
    },
    opts,
  )
}

// Re-export the legacy scorers so callers/tests can compare capability-engine
// selection against today's router pick (the zero-behavior-change assertion).
export { scoreProviders, pickProvider, scoreVideoProviders, pickVideoProvider }
