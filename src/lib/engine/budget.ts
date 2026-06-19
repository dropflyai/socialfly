/**
 * CREDIT BUDGET CONTROL (rung B0) — the cost-runaway firewall.
 *
 * The #1 production margin risk is cost-runaway: a loop / abuse / over-generation
 * burning Higgsfield credits (real cost $0.0475/cr). This session itself burned
 * ~1,300 credits (~$62) in unsanctioned subagent generation — exactly the failure
 * mode this module exists to stop. (docs/02-PRICING-MODEL.md §"cost-runaway is the
 * #1 killer"; docs/_brain_outputs/pricing-finance.md for per-asset credit costs.)
 *
 * This module is a PURE, FAIL-SAFE gate that sits BEFORE any provider dispatch in
 * the capability engine. It NEVER calls a provider, NEVER throws into the gen path,
 * and a BLOCK means STOP — never reroute/cascade to FAL to "get around" the cap.
 *
 * THREE independent controls, all DEFAULT-SAFE (unconfigured → ALLOW, today's behavior):
 *   1. GLOBAL kill-switch (ENGINE_GENERATION_KILL_SWITCH=true) — emergency stop, blocks ALL.
 *   2. Per-REQUEST ceiling (ENGINE_MAX_CREDITS_PER_GEN) — one absurd call → block.
 *   3. Per-TENANT daily cap (ENGINE_DAILY_CREDIT_CAP) — sum(spend today UTC)+estimate > cap → block.
 *
 * Storage of prior-spend is INJECTED (DailySpendReader) — the same DI seam the rest of
 * the engine uses — so the gate is provable with a mock and zero DB/network.
 */

import { getConfig, getSupabase } from './config'
import type { Capability, QualityTier, EngineId, CapabilityPlan } from './types'

// ============================================================================
// COST MAP (§ from docs/_brain_outputs/pricing-finance.md §0 VERIFIED costs)
//
// Static credit-cost estimate per (capability × model × tier). Used to check the
// budget BEFORE any spend. Numbers are the planning credits at $0.0475/cr:
//   cheap image ~1cr · premium image 2cr · video 16.5–30cr · TTS 2cr · music 2cr
//   sfx 0.4cr · soul-train ~30cr.
//
// Resolution order in estimateCredits():
//   1. exact MODEL override (modelCredits) when the plan names a known model,
//   2. else the capability base (capabilityCredits),
//   3. × tier multiplier (draft cheaper, premium dearer).
// ============================================================================

/** Per-capability BASE credit cost at the STANDARD tier (pricing-finance.md §0). */
const CAPABILITY_CREDITS: Partial<Record<Capability, number>> = {
  // images — cheap base ~1cr, premium 2cr (tier multiplier lifts standard→premium)
  image_gen: 2,
  persona_consistent_image: 2,
  brand_kit_image: 2,
  // video — planning midpoint ~22cr (Veo/Seedance), Cinematic up to 30cr
  video_gen: 22,
  persona_consistent_video: 22,
  ad_reference_video: 22,
  marketing_studio_video: 22,
  preset_i2v: 22,
  // audio
  audio_tts: 2,    // TTS / voiceover
  audio_music: 2,  // music bed
  audio_sfx: 0.4,  // sfx
  // post-processing (cheap)
  reframe: 1,
  outpaint: 2,
  upscale: 1,
  remove_bg: 1,
  // intelligence (best-effort; virality_predictor unreliable → modeled cheap)
  video_analysis: 2,
  virality_predict: 2,
  // 3D
  image_to_3d: 3,
}

/**
 * MODEL-specific overrides (more precise than the capability base) — keyed by the
 * concrete HF model id the plan/registry carries. Tier multiplier still applies on top.
 * Soul training is a one-time ~30cr persona cost (pricing-finance.md §0).
 */
const MODEL_CREDITS: Record<string, number> = {
  // video models (verified ledger ranges) — use the midpoint as the standard estimate
  seedance_2_0: 22,          // Seedance 2.0 ~22.5cr
  veo_3_1: 19,               // Veo 3.1 16.5–22cr
  cinematic_3_0: 28,         // Cinematic 3.0 25–30cr
  marketing_studio_video: 22,
  // premium image (Nano-Banana Pro 2K, Marketing Studio) = 2cr
  nano_banana_pro: 2,
  ms_image: 2,
  // soul training (one-time/persona) — NOT a per-post cost, but mapped for completeness
  soul_2: 2,                 // soul-driven IMAGE gen is 2cr; training itself ~30cr (below)
  soul_train: 30,            // explicit soul-training estimate
  // audio
  inworld_text_to_speech: 2,
  sonilo_music: 2,
  mirelo_text_to_audio: 0.4,
  // FAL commodity lane is billed in $ separately — ~free in HF credits.
  'flux/schnell': 0.5,
  seedance: 0.5,
}

/** Tier multiplier — draft cheaper, premium dearer (mirrors capability-engine TIER_MULTIPLIER). */
const TIER_MULTIPLIER: Record<QualityTier, number> = { draft: 0.4, standard: 1, premium: 2 }

/**
 * The minimal shape estimateCredits needs from a resolved plan. A CapabilityPlan
 * satisfies this; tests can pass a bare object. (engine='fal' → commodity lane.)
 */
export interface CostInput {
  engine?: EngineId
  capability: Capability
  model?: string
  qualityTier?: QualityTier
}

/**
 * Estimate the credit cost of a plan BEFORE generation. Pure & synchronous.
 * Resolution: model override → capability base → 2cr fallback, × tier multiplier.
 * FAL is the commodity lane (billed in $, ~free in HF credits) → always cheap.
 */
export function estimateCredits(plan: CostInput): number {
  const tier: QualityTier = plan.qualityTier ?? 'standard'
  const mult = TIER_MULTIPLIER[tier]

  // FAL commodity lane: ~free in HF credits regardless of model/capability.
  if (plan.engine === 'fal') return 0.5 * mult

  const base =
    (plan.model && MODEL_CREDITS[plan.model] !== undefined)
      ? MODEL_CREDITS[plan.model]
      : (CAPABILITY_CREDITS[plan.capability] ?? 2)

  // round to 2dp to keep the audit ledger tidy.
  return Math.round(base * mult * 100) / 100
}

// ============================================================================
// DAILY SPEND READER (injected) — the prior-spend lookup.
//
// Returns the SUM of hf_credits_spent for a tenant for the CURRENT UTC day. The
// default reads generation_jobs via the service-role Supabase client; tests inject
// a mock that returns a controllable number (no DB). This is the ONE piece that
// needs a live DB to be exact in production — the enforcement LOGIC is fully proven
// against the mock here.
// ============================================================================

export type DailySpendReader = (ownerId: string, sinceUtcMs: number) => Promise<number>

/** Start-of-day in UTC (ms) for a given clock — the daily window boundary. */
export function startOfUtcDay(now: number = Date.now()): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Default reader: sum generation_jobs.hf_credits_spent for owner where created_at >=
 * start-of-UTC-day. Best-effort — on ANY error it returns 0 (fail-OPEN on the READ so
 * a DB hiccup never wedges the pipeline; the kill-switch is the hard stop). NEEDS-LIVE-DB.
 */
export const defaultDailySpendReader: DailySpendReader = async (ownerId, sinceUtcMs) => {
  try {
    const supabase = getSupabase()
    const sinceIso = new Date(sinceUtcMs).toISOString()
    const { data, error } = await supabase
      .from('generation_jobs')
      .select('hf_credits_spent')
      .eq('user_id', ownerId)
      .gte('created_at', sinceIso)
    if (error || !data) return 0
    return (data as { hf_credits_spent: number | null }[])
      .reduce((sum, r) => sum + (typeof r.hf_credits_spent === 'number' ? r.hf_credits_spent : 0), 0)
  } catch {
    return 0
  }
}

// ============================================================================
// BUDGET CHECK — the gate decision.
// ============================================================================

export type BudgetBlockReason =
  | 'kill_switch'        // global emergency stop
  | 'per_request_ceiling' // single estimate > ENGINE_MAX_CREDITS_PER_GEN
  | 'daily_cap'          // spend-today + estimate > per-tenant daily cap

export interface BudgetDecision {
  /** true → STOP. The capability engine must surface this as a degrade/skip, NEVER cascade. */
  blocked: boolean
  reason?: BudgetBlockReason
  estimatedCredits: number
  /** spend-so-far today (only resolved when the daily-cap path runs). */
  spentToday?: number
  /** the effective cap that applied (per-request ceiling or daily cap), for audit. */
  limit?: number
  /** human-readable audit string (recorded on the blocked generation_jobs row). */
  message?: string
}

export interface CheckBudgetOptions {
  /** Injected prior-spend reader (default = generation_jobs sum). */
  spendReader?: DailySpendReader
  /** Injected clock (tests pin the UTC day; default Date.now). */
  now?: () => number
  /** Per-tenant cap override hook (tier-based caps later). Falls back to config default. */
  dailyCapOverride?: number
}

/**
 * Decide whether a generation of `estimatedCredits` for `ownerId` is allowed.
 * FAIL-SAFE & default-safe: with NO kill-switch, NO per-request ceiling, and NO
 * daily cap configured → ALWAYS allowed (today's behavior), and the daily-spend
 * READ is not even performed (zero cost on the correctly-configured low-volume path).
 *
 * Order of checks (most→least drastic): kill-switch → per-request ceiling → daily cap.
 */
export async function checkBudget(
  ownerId: string | undefined,
  estimatedCredits: number,
  opts: CheckBudgetOptions = {},
): Promise<BudgetDecision> {
  const cfg = getConfig()

  // 1. GLOBAL kill-switch — emergency stop, blocks ALL generation immediately.
  if (cfg.engineGenerationKillSwitch) {
    return {
      blocked: true,
      reason: 'kill_switch',
      estimatedCredits,
      message: 'ENGINE_GENERATION_KILL_SWITCH active — all generation halted (emergency stop)',
    }
  }

  // 2. Per-REQUEST ceiling — stop one absurd call regardless of tenant history.
  const ceiling = cfg.engineMaxCreditsPerGen
  if (ceiling !== undefined && estimatedCredits > ceiling) {
    return {
      blocked: true,
      reason: 'per_request_ceiling',
      estimatedCredits,
      limit: ceiling,
      message: `estimate ${estimatedCredits}cr exceeds per-request ceiling ${ceiling}cr (ENGINE_MAX_CREDITS_PER_GEN)`,
    }
  }

  // 3. Per-TENANT daily cap. Override hook (tier-based) wins; else config default.
  const dailyCap = opts.dailyCapOverride ?? cfg.engineDailyCreditCap
  if (dailyCap === undefined) {
    // Unconfigured → ALLOW (today's behavior). No spend read performed.
    return { blocked: false, estimatedCredits }
  }
  // Owner is required to attribute spend; if none, we cannot enforce a per-tenant cap.
  // (kill-switch + ceiling already had their say) → allow but flag no owner.
  if (!ownerId) {
    return { blocked: false, estimatedCredits, message: 'no ownerId — daily cap not enforced' }
  }

  const now = opts.now ? opts.now() : Date.now()
  const since = startOfUtcDay(now)
  const reader = opts.spendReader ?? defaultDailySpendReader
  const spentToday = await reader(ownerId, since)

  if (spentToday + estimatedCredits > dailyCap) {
    return {
      blocked: true,
      reason: 'daily_cap',
      estimatedCredits,
      spentToday,
      limit: dailyCap,
      message: `daily cap ${dailyCap}cr would be exceeded: spent ${spentToday}cr today + ${estimatedCredits}cr estimate (ENGINE_DAILY_CREDIT_CAP)`,
    }
  }

  return { blocked: false, estimatedCredits, spentToday, limit: dailyCap }
}

/** True when ANY budget control is configured (used to short-circuit logging-only mode). */
export function isBudgetControlActive(): boolean {
  const cfg = getConfig()
  return (
    !!cfg.engineGenerationKillSwitch ||
    cfg.engineMaxCreditsPerGen !== undefined ||
    cfg.engineDailyCreditCap !== undefined
  )
}
