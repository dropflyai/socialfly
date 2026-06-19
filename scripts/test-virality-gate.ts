#!/usr/bin/env npx tsx
/**
 * U4 CONTRACT TEST — pre-publish VIRALITY / QUALITY GATE.
 *
 * Pure, hermetic: a MOCKED LLM-judge + a MOCKED predictor + a MOCKED capability
 * generator (no network, no ANTHROPIC_API_KEY, no Higgsfield) prove the U4
 * acceptance criteria:
 *   (a) pass            → proceed (the draft is the chosen result).
 *   (b) reject          → ONE bounded revise → still failing → skip (no publish/premium).
 *   (c) predictor-unavailable → judge-only still gates (verdict from judge alone).
 *   (d) judge-unavailable     → gate_skipped, pipeline NOT blocked (outcome 'skipped', media kept).
 *   (e) two-phase: premium step runs ONLY on pass (premiumOnPass) and NOT on reject.
 *   (f) gate default-OFF → outcome 'gate_off', ONE standard gen, zero gate calls.
 *
 * Run: npx tsx scripts/test-virality-gate.ts
 */

import { initEngine } from '../src/lib/engine/config.js'
import {
  scoreContent,
  gatedGenerate,
  brandDNAToGateContext,
  type JudgeFn,
  type PredictorFn,
  type GatedGenerateDeps,
  type GatedGenerateRequest,
} from '../src/lib/engine/virality-gate.js'
import type {
  CapabilityRequest,
  CapabilityResult,
  ScoreContentInput,
  BrandDNA,
} from '../src/lib/engine/types.js'
import type { JudgeVerdict } from '../src/lib/ai/claude.js'

let failures = 0
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.error(`  ✗ ${label}`) }
}

const BASE_CFG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceKey: 'svc',
  anthropicApiKey: 'a',
  falApiKey: 'f',
}

const DNA: BrandDNA = {
  id: 'soul-1',
  brandName: 'DropFly',
  oneLiner: 'AI build machine',
  voice: { tone: ['bold', 'technical'], do: ['show proof'], dont: ['hype', 'slop'] },
  visual: { brandGradient: [], aesthetic: ['cinematic', 'high-contrast'], avoid: ['stock-photo', 'generic'] },
  platformPolicy: { primary: ['tiktok'], secondary: [] },
  contentPillars: [],
  audience: [],
  higgsfield: { soulId: null, brandKitId: null, brandKitStyleId: null, referenceElementIds: [] },
}

// --- mock scorers ---------------------------------------------------------

/** A judge that returns a fixed score (→ verdict derived from threshold). */
function fixedJudge(score: number): JudgeFn {
  return async (_input, threshold): Promise<JudgeVerdict> => {
    const reviseFloor = Math.max(0, threshold - 0.2)
    const verdict = score >= threshold ? 'pass' : score >= reviseFloor ? 'revise' : 'reject'
    return { score, verdict, reasons: [`judge gave ${score}`] }
  }
}

/** A judge whose score improves on the 2nd (revised) call — proves bounded revise. */
function improvingJudge(first: number, second: number): JudgeFn {
  let n = 0
  return async (_input, threshold): Promise<JudgeVerdict> => {
    const score = n++ === 0 ? first : second
    const reviseFloor = Math.max(0, threshold - 0.2)
    const verdict = score >= threshold ? 'pass' : score >= reviseFloor ? 'revise' : 'reject'
    return { score, verdict, reasons: [`judge call#${n} → ${score}`] }
  }
}

/** A judge that throws — simulates no ANTHROPIC_API_KEY / outage. */
const throwingJudge: JudgeFn = async () => { throw new Error('ANTHROPIC_API_KEY not configured (LLM-judge unavailable)') }

const predictorUnavailable: PredictorFn = async () => null
function predictorScore(score: number): PredictorFn { return async () => ({ score, reasons: [`predictor ${score}`] }) }

/** A capability generator that records every call + returns a tier-tagged url. */
function mockGenerator() {
  const calls: CapabilityRequest[] = []
  const generate = async (req: CapabilityRequest): Promise<CapabilityResult> => {
    calls.push(req)
    return {
      url: `https://mock/${req.qualityTier ?? 'standard'}-${calls.length}.png`,
      prompt: req.prompt,
      provider: 'fal',
      meta: { engine: 'fal', capability: req.capability, model: 'mock' },
    }
  }
  return { generate, calls }
}

// ---------------------------------------------------------------------------

async function testPassProceeds() {
  console.log('\n[A] pass → proceed (draft is the chosen result)')
  initEngine({ ...BASE_CFG })
  const { generate, calls } = mockGenerator()
  const deps: GatedGenerateDeps = { generate, judge: fixedJudge(0.85), predictor: predictorUnavailable }
  const req: GatedGenerateRequest = {
    capability: 'image_gen', prompt: 'a cinematic build wall', mediaType: 'image',
    brandDNA: DNA, platform: 'tiktok', enabled: true,
  }
  const out = await gatedGenerate(req, deps)
  assert(out.outcome === 'passed', `outcome is 'passed' (got ${out.outcome})`)
  assert(out.attempts === 1, 'exactly ONE draft generation (no revise)')
  assert(!!out.result?.url, 'returns a usable media result')
  assert(out.gate?.verdict === 'pass', 'gate verdict is pass')
  assert(calls.every(c => c.qualityTier === 'draft'), 'only a draft-tier gen ran (no premium requested)')
}

async function testRejectBoundedReviseSkip() {
  console.log('\n[B] reject → ONE bounded revise → still failing → skip (no premium spend)')
  initEngine({ ...BASE_CFG })
  const { generate, calls } = mockGenerator()
  // first draft revise-band (0.45 with threshold 0.6 → revise), revised still reject (0.2).
  const deps: GatedGenerateDeps = { generate, judge: improvingJudge(0.45, 0.2), predictor: predictorUnavailable }
  const req: GatedGenerateRequest = {
    capability: 'image_gen', prompt: 'generic stock slop', mediaType: 'image',
    brandDNA: DNA, premiumOnPass: true, enabled: true, threshold: 0.6,
  }
  const out = await gatedGenerate(req, deps)
  assert(out.outcome === 'rejected', `outcome is 'rejected' (got ${out.outcome})`)
  assert(out.attempts === 2, 'exactly TWO draft gens (initial + ONE bounded revise)')
  assert(!out.result, 'no media result returned (skipped)')
  assert(!out.premium && !calls.some(c => c.qualityTier === 'premium'), 'premium step did NOT run on reject')
  assert(!!calls[1]?.prompt?.includes('REVISION'), 'the revise re-gen folded judge feedback into the prompt')
}

async function testPassAfterReviseThenPremium() {
  console.log('\n[B2] revise → second clears threshold → premium re-render runs on the winner')
  initEngine({ ...BASE_CFG })
  const { generate, calls } = mockGenerator()
  const deps: GatedGenerateDeps = { generate, judge: improvingJudge(0.5, 0.9), predictor: predictorUnavailable }
  const req: GatedGenerateRequest = {
    capability: 'image_gen', prompt: 'almost there', mediaType: 'image',
    brandDNA: DNA, premiumOnPass: true, enabled: true, threshold: 0.6,
  }
  const out = await gatedGenerate(req, deps)
  assert(out.outcome === 'passed_after_revise', `outcome 'passed_after_revise' (got ${out.outcome})`)
  assert(out.attempts === 2, 'one initial + one revise draft')
  assert(!!out.premium && out.premium.meta.capability === 'image_gen', 'premium re-render produced')
  assert(calls.some(c => c.qualityTier === 'premium'), 'a premium-tier gen ran ONLY after pass')
}

async function testPredictorUnavailableJudgeOnly() {
  console.log('\n[C] predictor-unavailable → judge-only still gates')
  initEngine({ ...BASE_CFG })
  // VIDEO content so the predictor branch is exercised; predictor returns null.
  const input: ScoreContentInput = {
    media: 'https://mock/v.mp4', mediaType: 'video', prompt: 'reel', brandDNA: DNA, platform: 'tiktok',
  }
  const gate = await scoreContent(input, { threshold: 0.6, judge: fixedJudge(0.72), predictor: predictorUnavailable })
  assert(gate.verdict === 'pass', 'judge-alone verdict gates (pass at 0.72 ≥ 0.6)')
  assert(gate.score === 0.72, 'merged score == judge score (predictor not blended)')
  assert(gate.scorers.judge?.score === 0.72, 'judge scorer recorded')
  assert(gate.scorers.predictor?.unavailable === true, 'predictor marked unavailable (best-effort)')
  assert(gate.degraded === true, 'gate flagged degraded (predictor missing) but STILL gated')
}

async function testPredictorBlendsWhenAvailable() {
  console.log('\n[C2] predictor available → blended with judge (enhancer)')
  initEngine({ ...BASE_CFG })
  const input: ScoreContentInput = { media: 'https://mock/v.mp4', mediaType: 'video', prompt: 'reel', brandDNA: DNA }
  const gate = await scoreContent(input, { threshold: 0.6, judge: fixedJudge(0.8), predictor: predictorScore(0.4) })
  // 0.6*0.8 + 0.4*0.4 = 0.64
  assert(Math.abs(gate.score - 0.64) < 1e-9, `merged score blends judge+predictor (got ${gate.score})`)
  assert(gate.scorers.predictor?.unavailable !== true, 'predictor scorer counted')
}

async function testJudgeUnavailableGateSkipped() {
  console.log('\n[D] judge-unavailable → gate_skipped, pipeline NOT blocked')
  initEngine({ ...BASE_CFG })
  const input: ScoreContentInput = { media: 'https://mock/x.png', mediaType: 'image', prompt: 'x', brandDNA: DNA }
  const gate = await scoreContent(input, { threshold: 0.6, judge: throwingJudge, predictor: predictorUnavailable })
  assert(gate.gateSkipped === true, 'gateSkipped === true (no judge)')
  assert(gate.verdict === 'pass', "verdict 'pass' so publish is NOT blocked")

  // and the full flow keeps the draft (does not crash / does not reject).
  const { generate } = mockGenerator()
  const out = await gatedGenerate(
    { capability: 'image_gen', prompt: 'x', mediaType: 'image', brandDNA: DNA, enabled: true },
    { generate, judge: throwingJudge, predictor: predictorUnavailable },
  )
  assert(out.outcome === 'skipped', `flow outcome 'skipped' (got ${out.outcome})`)
  assert(!!out.result?.url, 'flow STILL returns the draft media (publish proceeds)')
}

async function testGateDefaultOff() {
  console.log('\n[F] gate default-OFF → zero behavior change (one standard gen, no gate calls)')
  initEngine({ ...BASE_CFG }) // engineViralityGate defaults false
  const { generate, calls } = mockGenerator()
  let judgeCalled = 0
  const spyJudge: JudgeFn = async (i, t) => { judgeCalled++; return fixedJudge(0.9)(i, t) }
  // No `enabled` → gated on config (false).
  const out = await gatedGenerate(
    { capability: 'image_gen', prompt: 'untouched', mediaType: 'image', brandDNA: DNA },
    { generate, judge: spyJudge, predictor: predictorUnavailable },
  )
  assert(out.outcome === 'gate_off', `outcome 'gate_off' (got ${out.outcome})`)
  assert(out.attempts === 1, 'exactly ONE generation')
  assert(calls[0]?.qualityTier === 'standard', 'single STANDARD-tier gen (normal path, not draft)')
  assert(judgeCalled === 0, 'the judge was NEVER called (gate did not run)')
  assert(!!out.result?.url, 'returns the media result')
}

function testBrandContextMapping() {
  console.log('\n[E] brand DNA → gate context mapping')
  const ctx = brandDNAToGateContext(DNA)
  assert(ctx.brandName === 'DropFly', 'brandName mapped')
  assert(JSON.stringify(ctx.voiceDont) === JSON.stringify(['hype', 'slop']), 'voice DONT mapped (anti-slop axis)')
  assert(JSON.stringify(ctx.avoid) === JSON.stringify(['stock-photo', 'generic']), 'visual avoid mapped')
  const empty = brandDNAToGateContext(null)
  assert(Object.keys(empty).length === 0, 'null DNA → empty context (no crash)')
}

async function main() {
  console.log('=== U4 virality/quality-gate contract test (mocked judge + predictor + generator) ===')
  await testPassProceeds()
  await testRejectBoundedReviseSkip()
  await testPassAfterReviseThenPremium()
  await testPredictorUnavailableJudgeOnly()
  await testPredictorBlendsWhenAvailable()
  await testJudgeUnavailableGateSkipped()
  await testGateDefaultOff()
  testBrandContextMapping()

  console.log(`\n${failures === 0 ? 'ALL PASS ✅' : `FAILED ❌ (${failures} assertion(s))`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => { console.error('UNEXPECTED ERROR:', err); process.exit(1) })
