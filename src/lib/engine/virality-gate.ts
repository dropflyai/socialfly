/**
 * Pre-publish VIRALITY / QUALITY GATE (rung U4)
 *
 * The two-phase "predict-cheap → gate → generate-premium" flow + the resilient
 * scorer that gates it. Design authority: docs/01-CAPABILITY-ENGINE-RESPEC.md
 * §4.5 (two-phase flow) and §4.3/§4.4 (fail-soft ladder). This is ADDITIVE and
 * DEFAULT-OFF: with engineViralityGate=false (the default) NOTHING here runs and
 * the existing pipeline is byte-identical to today.
 *
 * THE GATE IS RESILIENT, NOT PREDICTOR-DEPENDENT. Higgsfield's virality_predictor
 * failed twice in earlier testing and its REST surface is POST-only / unconfirmed,
 * so:
 *   PRIMARY scorer  = an LLM-judge (src/lib/ai/claude.ts judgeContentAgainstBrand)
 *                     → reliable baseline; works for image OR video.
 *   ENHANCER scorer = virality_predictor (Higgsfield, VIDEO only) → best-effort;
 *                     merged into the score ONLY when it actually returns a number.
 *
 * FAIL-SOFT cascade (a broken gate must NEVER block the pipeline):
 *   - predictor unavailable        → LLM-judge alone gates.
 *   - LLM-judge unavailable        → SKIP the gate (gateSkipped=true), DO NOT block
 *     (no ANTHROPIC_API_KEY)          publish; record a gate_skipped reason.
 */

import { getConfig } from './config'
import {
  judgeContentAgainstBrand,
  type JudgeContentInput,
  type JudgeVerdict,
} from '../ai/claude'
import type {
  GateScore,
  GateVerdict,
  ScorerResult,
  ScoreContentInput,
  GateBrandContext,
  BrandDNA,
  CapabilityRequest,
  CapabilityResult,
  GateMediaType,
} from './types'

// ============================================================================
// Defaults + injectable scorer seams (so contract tests run with NO network/keys)
// ============================================================================

export const DEFAULT_GATE_THRESHOLD = 0.6

/** The LLM-judge seam. Default → the repo's Claude judge. Tests inject a mock. */
export type JudgeFn = (input: JudgeContentInput, threshold: number) => Promise<JudgeVerdict>

/** The predictor seam (Higgsfield virality_predictor, VIDEO only, best-effort).
 *  Returns a 0-1 score or null when unavailable. Default → unavailable (the REST
 *  surface is unconfirmed; the MCP predictor failed twice in earlier testing). */
export type PredictorFn = (input: ScoreContentInput) => Promise<{ score: number; reasons?: string[] } | null>

/** Default predictor: best-effort, currently UNAVAILABLE on the server surface.
 *  Wired here as a no-op so the gate degrades to judge-only by default rather than
 *  burning a probe on every call. A live predictor adapter can replace this later. */
const defaultPredictor: PredictorFn = async () => null

// ============================================================================
// Brand-DNA → gate context (the axes the judge scores against)
// ============================================================================

export function brandDNAToGateContext(dna?: BrandDNA | null): GateBrandContext {
  if (!dna) return {}
  return {
    brandName: dna.brandName,
    oneLiner: dna.oneLiner,
    voiceTone: dna.voice?.tone,
    voiceDo: dna.voice?.do,
    voiceDont: dna.voice?.dont,
    aesthetic: dna.visual?.aesthetic,
    avoid: dna.visual?.avoid,
  }
}

function thresholdFor(explicit?: number): number {
  if (typeof explicit === 'number') return explicit
  return getConfig().engineViralityGateThreshold ?? DEFAULT_GATE_THRESHOLD
}

function verdictFor(score: number, threshold: number): GateVerdict {
  const reviseFloor = Math.max(0, threshold - 0.2)
  if (score >= threshold) return 'pass'
  if (score >= reviseFloor) return 'revise'
  return 'reject'
}

// ============================================================================
// scoreContent — the resilient gate scorer (§4.4 fail-soft).
// ============================================================================

export interface ScoreContentOptions {
  threshold?: number
  judge?: JudgeFn          // injected for tests; default = judgeContentAgainstBrand
  predictor?: PredictorFn  // injected for tests; default = defaultPredictor (unavailable)
}

/**
 * Score one piece of content against the Brand DNA. Returns the merged
 * {score, verdict, reasons, scorers, degraded?, gateSkipped?}.
 *
 * Cascade:
 *  1. Run the LLM-judge (primary). If it throws (e.g. no ANTHROPIC_API_KEY) →
 *     SKIP the gate: return gateSkipped=true with verdict 'pass' so publish is
 *     NOT blocked. A broken gate must never stall the pipeline.
 *  2. For VIDEO, best-effort the predictor (enhancer). When it returns a number,
 *     blend it with the judge score; when it returns null, judge alone gates.
 */
export async function scoreContent(
  input: ScoreContentInput,
  opts: ScoreContentOptions = {},
): Promise<GateScore> {
  const threshold = thresholdFor(opts.threshold)
  const judge = opts.judge ?? judgeContentAgainstBrand
  const predictor = opts.predictor ?? defaultPredictor

  const ctx = brandDNAToGateContext(input.brandDNA)
  const judgeInput: JudgeContentInput = {
    mediaType: input.mediaType,
    prompt: input.prompt,
    caption: input.caption,
    platform: input.platform,
    brand: ctx,
  }

  // --- 1. PRIMARY: LLM-judge. Failure → gate_skipped (NEVER block publish). ---
  let judgeResult: ScorerResult | undefined
  try {
    const v = await judge(judgeInput, threshold)
    judgeResult = { score: clamp01(v.score), reasons: v.reasons ?? [] }
  } catch (err) {
    // Fail-soft: the gate could not score (no key / parse error / outage). Do NOT
    // block publish. Verdict 'pass' so the pipeline proceeds unchanged.
    console.warn(
      `[virality-gate] LLM-judge unavailable → SKIPPING gate (publish NOT blocked): ` +
      `${err instanceof Error ? err.message : String(err)}`
    )
    return {
      score: 1,
      verdict: 'pass',
      reasons: ['gate_skipped: LLM-judge unavailable (no ANTHROPIC_API_KEY or judge error)'],
      scorers: { judge: { score: 0, reasons: [], unavailable: true } },
      degraded: true,
      gateSkipped: true,
    }
  }

  // --- 2. ENHANCER: predictor (VIDEO only, best-effort). Merge when available. ---
  let predictorResult: ScorerResult | undefined
  if (input.mediaType === 'video') {
    try {
      const p = await predictor(input)
      if (p && typeof p.score === 'number') {
        predictorResult = { score: clamp01(p.score), reasons: p.reasons ?? [] }
      } else {
        predictorResult = { score: 0, reasons: ['predictor unavailable (best-effort)'], unavailable: true }
      }
    } catch (err) {
      predictorResult = {
        score: 0,
        reasons: [`predictor probe failed: ${err instanceof Error ? err.message : String(err)}`],
        unavailable: true,
      }
    }
  }

  // --- Merge. Judge is the dependable baseline. When the predictor returned a
  //     real number, blend 60% judge / 40% predictor (judge stays load-bearing). ---
  const usePredictor = predictorResult && !predictorResult.unavailable
  const merged = usePredictor
    ? 0.6 * judgeResult.score + 0.4 * predictorResult!.score
    : judgeResult.score

  const reasons = [...judgeResult.reasons]
  if (predictorResult && !predictorResult.unavailable) reasons.push(...predictorResult.reasons)

  return {
    score: clamp01(merged),
    verdict: verdictFor(merged, threshold),
    reasons,
    scorers: {
      judge: judgeResult,
      ...(predictorResult ? { predictor: predictorResult } : {}),
    },
    degraded: predictorResult?.unavailable ? true : undefined,
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

// ============================================================================
// TWO-PHASE FLOW (§4.5) — predict-cheap → gate → (one bounded revise) → premium.
//
// PHASE A (cheap)   : generate a DRAFT via the capability engine (qualityTier='draft').
// PHASE B (gate)    : scoreContent(draft).
//                     pass   → proceed (optionally a premium re-render on the winner).
//                     revise → ONE bounded re-generation with the judge's feedback
//                              folded into the prompt, then re-gate.
//                     reject → skip + log (after the bounded retry).
// PHASE C (premium) : runs ONLY on a passing draft, when premiumOnPass is requested.
//
// DEFAULT-OFF: gatedGenerate is only reached when an entry point passes enabled:true
// (or config.engineViralityGate is true). The default path is the unchanged pipeline.
// ============================================================================

/** Dependency seam so the flow is testable with NO network (mock generate + score). */
export interface GatedGenerateDeps {
  /** runs a capability request → result (default = the real runCapability). */
  generate: (req: CapabilityRequest) => Promise<CapabilityResult>
  /** scores a draft (default = scoreContent with the real judge/predictor). */
  score?: (input: ScoreContentInput, opts?: ScoreContentOptions) => Promise<GateScore>
  /** scorer injection forwarded to the default scoreContent. */
  judge?: JudgeFn
  predictor?: PredictorFn
}

export interface GatedGenerateRequest {
  capability: CapabilityRequest['capability']
  prompt: string
  mediaType: GateMediaType
  brandDNA?: BrandDNA | null
  /** the CapabilityBrandDNA bindings forwarded into generation (soul/brand_kit). */
  capabilityBrandDNA?: CapabilityRequest['brandDNA']
  platform?: import('./types').Platform
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
  userId?: string
  caption?: string
  /** when true, re-render the WINNER at premium tier after it passes (Phase C). */
  premiumOnPass?: boolean
  /** force-enable the gate for THIS call (else gated on config.engineViralityGate). */
  enabled?: boolean
  threshold?: number
}

export type GateOutcome = 'passed' | 'passed_after_revise' | 'skipped' | 'rejected' | 'gate_off'

export interface GatedGenerateResult {
  outcome: GateOutcome
  /** the chosen media result (draft, or premium re-render on pass). undefined if rejected. */
  result?: CapabilityResult
  /** the gate score that decided the outcome (absent when gate_off). */
  gate?: GateScore
  /** the premium re-render result (Phase C), when premiumOnPass + passed. */
  premium?: CapabilityResult
  /** how many draft generations ran (1 = pass first try; 2 = one bounded revise). */
  attempts: number
  reasons: string[]
}

function gateEnabled(req: GatedGenerateRequest): boolean {
  if (typeof req.enabled === 'boolean') return req.enabled
  return getConfig().engineViralityGate === true
}

function draftReq(req: GatedGenerateRequest, prompt: string): CapabilityRequest {
  return {
    capability: req.capability,
    prompt,
    brandDNA: req.capabilityBrandDNA,
    format: { aspectRatio: req.aspectRatio ?? '1:1', platform: req.platform },
    qualityTier: 'draft',
    userId: req.userId,
  }
}

function scoreInputFor(req: GatedGenerateRequest, result: CapabilityResult, prompt: string): ScoreContentInput {
  return {
    media: result.url,
    mediaType: req.mediaType,
    prompt,
    caption: req.caption,
    brandDNA: req.brandDNA,
    platform: req.platform,
  }
}

/** Fold the judge's revise feedback into the prompt for the ONE bounded retry. */
function reviseWithFeedback(prompt: string, gate: GateScore): string {
  const fixes = gate.reasons.slice(0, 4).join('; ')
  return `${prompt}\n\n[REVISION — address this feedback to improve hook/brand-fit/quality: ${fixes}]`
}

/**
 * The two-phase gated generation flow. When the gate is OFF (default), this is a
 * pass-through: it generates ONCE at standard tier and returns outcome 'gate_off'
 * (zero behavior change). When ON, it runs predict-cheap → gate → bounded-revise →
 * optional premium.
 */
export async function gatedGenerate(
  req: GatedGenerateRequest,
  deps: GatedGenerateDeps,
): Promise<GatedGenerateResult> {
  // DEFAULT-OFF: gate disabled → behave exactly like a single standard generation.
  if (!gateEnabled(req)) {
    const result = await deps.generate({
      capability: req.capability,
      prompt: req.prompt,
      brandDNA: req.capabilityBrandDNA,
      format: { aspectRatio: req.aspectRatio ?? '1:1', platform: req.platform },
      qualityTier: 'standard',
      userId: req.userId,
    })
    return { outcome: 'gate_off', result, attempts: 1, reasons: ['gate disabled (default)'] }
  }

  const threshold = thresholdFor(req.threshold)
  const score = deps.score
    ?? ((input: ScoreContentInput, opts?: ScoreContentOptions) =>
      scoreContent(input, { threshold, judge: deps.judge, predictor: deps.predictor, ...opts }))

  // --- PHASE A: cheap draft. ---
  let prompt = req.prompt
  let attempts = 0
  let draft = await deps.generate(draftReq(req, prompt))
  attempts++

  // --- PHASE B: gate. ---
  let gate = await score(scoreInputFor(req, draft, prompt))

  // gate_skipped → never block publish: proceed with the draft as a pass.
  if (gate.gateSkipped) {
    return { outcome: 'skipped', result: draft, gate, attempts, reasons: gate.reasons }
  }

  // revise → ONE bounded re-generation with feedback folded in, then re-gate.
  if (gate.verdict === 'revise') {
    prompt = reviseWithFeedback(prompt, gate)
    draft = await deps.generate(draftReq(req, prompt))
    attempts++
    gate = await score(scoreInputFor(req, draft, prompt))
  }

  // After the bounded retry: reject → skip + log (no publish, no premium spend).
  if (gate.verdict !== 'pass') {
    return {
      outcome: 'rejected',
      gate,
      attempts,
      reasons: ['rejected after bounded revise — skipping (no premium spend)', ...gate.reasons],
    }
  }

  const passedOutcome: GateOutcome = attempts > 1 ? 'passed_after_revise' : 'passed'

  // --- PHASE C: premium re-render of the WINNER (only on pass + when requested). ---
  if (req.premiumOnPass) {
    const premium = await deps.generate({
      capability: req.capability,
      prompt,
      brandDNA: req.capabilityBrandDNA,
      format: { aspectRatio: req.aspectRatio ?? '1:1', platform: req.platform },
      qualityTier: 'premium',
      userId: req.userId,
    })
    return { outcome: passedOutcome, result: premium, premium, gate, attempts, reasons: gate.reasons }
  }

  return { outcome: passedOutcome, result: draft, gate, attempts, reasons: gate.reasons }
}
