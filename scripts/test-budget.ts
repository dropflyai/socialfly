#!/usr/bin/env npx tsx
/**
 * B0 CONTRACT TEST — CREDIT BUDGET CONTROL (the cost-runaway firewall).
 *
 * Pure, hermetic: a MOCKED prior-spend reader (controllable today-total) + a MOCKED
 * SoulStorage (no DB) + a MOCKED Higgsfield transport prove the B0 acceptance criteria:
 *   (a) under cap                → ALLOWED (provider called, normal result).
 *   (b) estimate crosses daily cap → BLOCKED (NO provider call), status='blocked' recorded.
 *   (c) kill-switch on           → EVERYTHING blocked.
 *   (d) per-request ceiling      → a single oversized gen blocked.
 *   (e) a budget block does NOT cascade to FAL (STOP, not reroute).
 *   (f) unconfigured (no cap, no kill-switch) → ALLOWED = zero behavior change.
 *   (g) UTC day boundary resets the running total.
 *   (h) estimateCredits cost map: cheap img / premium img / video / tts / sfx / soul-train.
 *
 * Run: npx tsx scripts/test-budget.ts
 */

import { initEngine } from '../src/lib/engine/config.js'
import {
  __setHiggsfieldTransport,
} from '../src/lib/engine/providers/higgsfield.js'
import {
  resolvePlan,
  executeWithCascade,
  circuitBreaker,
} from '../src/lib/engine/capability-engine.js'
import {
  estimateCredits,
  checkBudget,
  startOfUtcDay,
  type DailySpendReader,
} from '../src/lib/engine/budget.js'
import type { CapabilityRequest } from '../src/lib/engine/types.js'
import type { SoulStorage, SoulStorageQuery } from '../src/lib/engine/brand.js'

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
  higgsfieldApiSecret: 'fake-secret-not-real',
}

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response
}

/** Mock SoulStorage capturing every recorded generation_jobs row. */
function mockStorage() {
  const recorded: { table?: string; row?: Record<string, unknown>; onConflict?: string }[] = []
  let current: { table?: string; row?: Record<string, unknown>; onConflict?: string } = {}
  const query: SoulStorageQuery = {
    select() { return query },
    eq() { return query },
    async maybeSingle() { return { data: null, error: null } },
    async single() { return { data: { id: 'job-mock-1', ...current.row }, error: null } },
    upsert(row, opts) { current.row = row; current.onConflict = opts?.onConflict; recorded.push(current); return query },
    insert(row) { current.row = row; recorded.push(current); return query },
  }
  const storage: SoulStorage = { from(table) { current = { table }; return query } }
  return { storage, recorded }
}

/** HF transport that completes an image job (used to detect "provider WAS called"). */
function hfTransport() {
  const state = { calls: 0 }
  __setHiggsfieldTransport(async (_url, init) => {
    state.calls++
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'POST') {
      return mockResponse({ id: 'job_b0', jobs: [{ id: 'j0', status: 'in_progress', results: null }] })
    }
    return mockResponse({
      id: 'job_b0',
      jobs: [{ id: 'j0', status: 'completed', results: { raw: { url: 'https://cdn.higgsfield.ai/b0.png', type: 'image' } } }],
    })
  })
  return state
}

/** A spend reader returning a fixed today-total, recording the window it was queried with. */
function fixedSpendReader(total: number) {
  const seen: { ownerId: string; since: number }[] = []
  const reader: DailySpendReader = async (ownerId, since) => { seen.push({ ownerId, since }); return total }
  return { reader, seen }
}

// ---------------------------------------------------------------------------

async function testUnderCapAllowed() {
  console.log('\n[A] under cap → ALLOWED (provider called)')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield', engineDailyCreditCap: 100 })
  const hf = hfTransport()
  const { storage, recorded } = mockStorage()
  const { reader } = fixedSpendReader(10) // 10 spent today, cap 100, est 2 → fine

  const req: CapabilityRequest = { capability: 'image_gen', prompt: 'cafe', qualityTier: 'standard', userId: 'u1' }
  const res = resolvePlan(req)
  const out = await executeWithCascade(res, req, { storage, spendReader: reader })

  assert(hf.calls >= 1, 'provider WAS called (under cap)')
  assert(out.provider === 'higgsfield' && !!out.url, 'normal result returned')
  assert(!out.meta.budgetBlocked, 'meta.budgetBlocked is falsey')
  assert(recorded.some(r => r.row?.status === 'completed'), "recorded status='completed' (not blocked)")
  __setHiggsfieldTransport(undefined)
}

async function testCrossesDailyCapBlocked() {
  console.log('\n[B] estimate crosses daily cap → BLOCKED (no provider call, status=blocked)')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield', engineDailyCreditCap: 50 })
  const hf = hfTransport()
  const { storage, recorded } = mockStorage()
  const { reader } = fixedSpendReader(49) // 49 spent, cap 50, est 2 → 51 > 50 → BLOCK

  const req: CapabilityRequest = { capability: 'image_gen', prompt: 'cafe', qualityTier: 'standard', userId: 'u1' }
  const res = resolvePlan(req)
  const out = await executeWithCascade(res, req, { storage, spendReader: reader })

  assert(hf.calls === 0, 'provider was NEVER called (blocked before dispatch)')
  assert(out.meta.budgetBlocked === true, 'meta.budgetBlocked === true')
  assert(out.meta.blockReason === 'daily_cap', "blockReason === 'daily_cap'")
  assert(out.meta.creditsSpent === 0, 'no credits recorded as spent on a block')
  assert(recorded.some(r => r.row?.status === 'blocked'), "generation_jobs row status='blocked' recorded (auditable)")
  assert(recorded.some(r => typeof r.row?.error === 'string' && (r.row!.error as string).includes('daily cap')), 'block reason captured in the audit row')
  __setHiggsfieldTransport(undefined)
}

async function testKillSwitchBlocksAll() {
  console.log('\n[C] kill-switch on → EVERYTHING blocked')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield', engineGenerationKillSwitch: true })
  const hf = hfTransport()
  const { storage } = mockStorage()
  const { reader, seen } = fixedSpendReader(0)

  const req: CapabilityRequest = { capability: 'image_gen', prompt: 'x', qualityTier: 'standard', userId: 'u1' }
  const res = resolvePlan(req)
  const out = await executeWithCascade(res, req, { storage, spendReader: reader })

  assert(hf.calls === 0, 'provider NOT called under kill-switch')
  assert(out.meta.budgetBlocked === true && out.meta.blockReason === 'kill_switch', "blocked with reason 'kill_switch'")
  assert(seen.length === 0, 'kill-switch short-circuits BEFORE any spend read (emergency stop)')
  __setHiggsfieldTransport(undefined)
}

async function testPerRequestCeiling() {
  console.log('\n[D] per-request ceiling → a single oversized gen blocked')
  circuitBreaker.reset()
  // video_gen standard ≈ 22cr; ceiling 10 → blocked. image_gen 2cr would pass.
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield', engineMaxCreditsPerGen: 10 })
  const { storage } = mockStorage()
  const { reader } = fixedSpendReader(0)

  const req: CapabilityRequest = { capability: 'video_gen', prompt: 'a reel', qualityTier: 'standard', userId: 'u1' }
  const res = resolvePlan(req)
  const out = await executeWithCascade(res, req, { storage, spendReader: reader })
  assert(out.meta.budgetBlocked === true && out.meta.blockReason === 'per_request_ceiling', "video blocked by 'per_request_ceiling'")

  // a cheap image under the same ceiling is allowed (proves it's per-call, not a blanket block).
  const hf = hfTransport()
  const imgReq: CapabilityRequest = { capability: 'image_gen', prompt: 'x', qualityTier: 'standard', userId: 'u1' }
  const imgOut = await executeWithCascade(resolvePlan(imgReq), imgReq, { storage, spendReader: reader })
  assert(!imgOut.meta.budgetBlocked && hf.calls >= 1, 'a cheap image under the same ceiling is ALLOWED')
  __setHiggsfieldTransport(undefined)
}

async function testBlockDoesNotCascade() {
  console.log('\n[E] a budget block does NOT cascade to FAL (STOP, not reroute)')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield', engineDailyCreditCap: 1 })
  const hf = hfTransport()

  // Spy on the FAL client so we can prove it was NEVER reached on a budget block.
  const falClient = (await import('@fal-ai/client')).fal
  const origSubscribe = falClient.subscribe
  let falCalls = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(falClient as any).subscribe = async () => { falCalls++; return { data: { images: [{ url: 'https://fal.cdn/x.png' }] } } }

  const { storage } = mockStorage()
  const { reader } = fixedSpendReader(5) // already over the cap of 1
  const req: CapabilityRequest = { capability: 'image_gen', prompt: 'x', qualityTier: 'standard', userId: 'u1' }
  const out = await executeWithCascade(resolvePlan(req), req, { storage, spendReader: reader })

  assert(out.meta.budgetBlocked === true, 'blocked')
  assert(hf.calls === 0, 'higgsfield NOT called')
  assert(falCalls === 0, 'FAL NOT called — a budget block did NOT reroute to the fallback')
  assert(out.provider !== 'fal' || out.url === undefined, 'no fallback media url produced')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(falClient as any).subscribe = origSubscribe
  __setHiggsfieldTransport(undefined)
}

async function testUnconfiguredZeroBehaviorChange() {
  console.log('\n[F] unconfigured (no cap, no kill-switch) → ALLOWED = zero behavior change')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield' }) // nothing budget-related set
  const hf = hfTransport()
  const { storage, recorded } = mockStorage()
  let readerCalled = 0
  const reader: DailySpendReader = async () => { readerCalled++; return 999999 } // would block IF read

  const req: CapabilityRequest = { capability: 'image_gen', prompt: 'x', qualityTier: 'standard', userId: 'u1' }
  const out = await executeWithCascade(resolvePlan(req), req, { storage, spendReader: reader })

  assert(hf.calls >= 1, 'provider called (allowed) when nothing is configured')
  assert(!out.meta.budgetBlocked, 'not blocked')
  assert(readerCalled === 0, 'spend reader NOT even invoked when uncapped (zero added cost on the happy path)')
  assert(recorded.some(r => r.row?.status === 'completed'), "completed normally")
  __setHiggsfieldTransport(undefined)
}

async function testDayBoundaryResets() {
  console.log('\n[G] UTC day boundary resets the running total')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, engineDailyCreditCap: 50 })

  // A reader that "remembers" two days of spend keyed by the since-window it is given.
  // Day-1 window has 49cr; the next UTC day's window has 0cr.
  const day1 = Date.UTC(2026, 5, 18, 23, 0, 0)   // 2026-06-18 23:00Z
  const day2 = Date.UTC(2026, 5, 19, 1, 0, 0)    // 2026-06-19 01:00Z (next UTC day)
  const ledger: Record<number, number> = {
    [startOfUtcDay(day1)]: 49,
    [startOfUtcDay(day2)]: 0,
  }
  const reader: DailySpendReader = async (_owner, since) => ledger[since] ?? 0

  // On day-1 (49 + est 2 = 51 > 50) → blocked.
  const d1 = await checkBudget('u1', 2, { spendReader: reader, now: () => day1 })
  assert(d1.blocked && d1.reason === 'daily_cap', 'day-1 (49cr already) → blocked')

  // Crossing into day-2 the running total resets (different UTC-day window → 0cr) → allowed.
  const d2 = await checkBudget('u1', 2, { spendReader: reader, now: () => day2 })
  assert(!d2.blocked, 'next UTC day → running total reset → allowed')
  assert(d2.spentToday === 0, 'spentToday read from the NEW day window (0cr)')
}

function testCostMap() {
  console.log('\n[H] estimateCredits cost map (pricing-finance.md §0)')
  // cheap image (FAL commodity lane) ~0.5cr
  assert(estimateCredits({ engine: 'fal', capability: 'image_gen', qualityTier: 'standard' }) === 0.5, 'FAL commodity image ~0.5cr')
  // premium image (HF) = 2cr standard
  assert(estimateCredits({ engine: 'higgsfield', capability: 'image_gen', qualityTier: 'standard' }) === 2, 'premium image = 2cr')
  // video standard ≈ 22cr (Seedance/Veo midpoint)
  assert(estimateCredits({ engine: 'higgsfield', capability: 'video_gen', qualityTier: 'standard' }) === 22, 'video ≈ 22cr')
  // tts = 2cr, sfx = 0.4cr
  assert(estimateCredits({ engine: 'higgsfield', capability: 'audio_tts', qualityTier: 'standard' }) === 2, 'TTS = 2cr')
  assert(estimateCredits({ engine: 'higgsfield', capability: 'audio_sfx', qualityTier: 'standard' }) === 0.4, 'SFX = 0.4cr')
  // music = 2cr
  assert(estimateCredits({ engine: 'higgsfield', capability: 'audio_music', qualityTier: 'standard' }) === 2, 'music = 2cr')
  // soul-train one-time ~30cr via model override
  assert(estimateCredits({ engine: 'higgsfield', capability: 'persona_consistent_image', model: 'soul_train', qualityTier: 'standard' }) === 30, 'soul-train = 30cr')
  // tier multiplier: premium doubles, draft cheapens
  assert(estimateCredits({ engine: 'higgsfield', capability: 'image_gen', qualityTier: 'premium' }) === 4, 'premium image = 4cr (×2)')
  assert(estimateCredits({ engine: 'higgsfield', capability: 'video_gen', qualityTier: 'draft' }) === 8.8, 'draft video = 8.8cr (×0.4)')
}

async function main() {
  console.log('=== B0 credit-budget-control contract test (mocked spend reader + storage + transport) ===')
  await testUnderCapAllowed()
  await testCrossesDailyCapBlocked()
  await testKillSwitchBlocksAll()
  await testPerRequestCeiling()
  await testBlockDoesNotCascade()
  await testUnconfiguredZeroBehaviorChange()
  await testDayBoundaryResets()
  testCostMap()

  console.log(`\n${failures === 0 ? 'ALL PASS ✅' : `FAILED ❌ (${failures} assertion(s))`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => { console.error('UNEXPECTED ERROR:', err); process.exit(1) })
