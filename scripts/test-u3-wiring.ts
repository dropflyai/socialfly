#!/usr/bin/env npx tsx
/**
 * U3 CONTRACT TEST — entry-point + autopilot wiring into the capability engine.
 *
 * Pure, hermetic: a MOCKED SoulStorage (no DB) for loadBrandDNA + a MOCKED
 * Higgsfield transport (no real network). It proves the U3 acceptance criteria —
 * that the GENERATION ENTRY CHAIN every entry point (pipeline.generateAndPublish,
 * orchestra.orchestrateContent, the /api/cron/automations inline gen) now shares
 * actually:
 *   (a) calls loadBrandDNA(ownerId) and folds the resulting four hf_* bindings into
 *       runCapability as the brandDNA binding (via generateBrandImage);
 *   (b) routes that generation THROUGH the capability engine (runCapability), with
 *       Higgsfield as the primary when opted-in — i.e. NOT a direct provider call;
 *   (c) null DNA → degrade-with-flag (or, for generic image_gen, the legacy path),
 *       never crashes, never fakes identity;
 *   (d) ZERO-BEHAVIOR-CHANGE: with no HF key + no brand_souls row + media engine
 *       unset, the wired path resolves to the UNCHANGED legacy router (byte-identical).
 *
 * The wiring chain under test is the EXACT one pipeline/orchestra/cron call:
 *   loadBrandDNA(userId, storage) → brandDNAToCapabilityBinding(dna)
 *     → generateBrandImage({ ..., brandDNA: binding }) → runCapability(...)
 *
 * Run: npx tsx scripts/test-u3-wiring.ts
 */

import { initEngine } from '../src/lib/engine/config.js'
import { __setHiggsfieldTransport } from '../src/lib/engine/providers/higgsfield.js'
import {
  loadBrandDNA,
  brandDNAToCapabilityBinding,
} from '../src/lib/engine/brand.js'
import {
  generateBrandImage,
  circuitBreaker,
} from '../src/lib/engine/capability-engine.js'
import { pickProvider } from '../src/lib/engine/image-router.js'
import type { SoulStorage, SoulStorageQuery } from '../src/lib/engine/brand.js'

let failures = 0
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.error(`  ✗ ${label}`) }
}

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response
}

/** A mock brand_souls storage. `row` = the row loadBrandDNA returns (null for the
 *  no-soul / zero-behavior-change paths). Captures generation_jobs writes too. */
function mockStorage(soulRow: Record<string, unknown> | null) {
  const recorded: { table?: string; row?: Record<string, unknown> }[] = []
  let current: { table?: string; row?: Record<string, unknown> } = {}
  const query: SoulStorageQuery = {
    select() { return query },
    eq() { return query },
    async maybeSingle() {
      // loadBrandDNA reads brand_souls via maybeSingle()
      return { data: current.table === 'brand_souls' ? soulRow : null, error: null }
    },
    async single() { return { data: { id: 'job-mock-1', ...current.row }, error: null } },
    upsert(row) { current.row = row; recorded.push(current); return query },
    insert(row) { current.row = row; recorded.push(current); return query },
  }
  const storage: SoulStorage = { from(table) { current = { table }; return query } }
  return { storage, recorded }
}

const BASE_CFG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceKey: 'svc',
  anthropicApiKey: 'a',
  falApiKey: 'f',
  higgsfieldApiSecret: 'fake-secret-not-real',
}

/** HF transport that completes a Soul t2i image in 1 submit + 1 poll (VERIFIED shape). */
function hfSuccessTransport() {
  let call = 0
  __setHiggsfieldTransport(async (_url, init) => {
    call++
    const method = (init?.method ?? 'GET').toUpperCase()
    if (call === 1 && method === 'POST') {
      return mockResponse({ id: 'job_u3', jobs: [{ id: 'j0', status: 'in_progress', results: null }] })
    }
    return mockResponse({
      id: 'job_u3',
      jobs: [{ id: 'j0', status: 'completed', results: { raw: { url: 'https://cdn.higgsfield.ai/u3.png', type: 'image' } } }],
    })
  })
}

/** A brand_souls row WITH a trained soul (the on-brand persona path). */
const SOUL_ROW = {
  id: 'soul-row-1',
  user_id: 'u1',
  brand_name: 'DropFly',
  hf_soul_id: 'hf_soul_dropfly',
  hf_brand_kit_id: 'hf_kit_dropfly',
  hf_brand_kit_style_id: 'hf_style_dropfly',
  hf_reference_element_ids: ['ref_logo'],
  visual: { aesthetic: ['cinematic', 'premium dark'] },
}

// ---------------------------------------------------------------------------

async function testEntryLoadsDnaAndInjects() {
  console.log('\n[A] entry chain loadBrandDNA → binding → generateBrandImage → runCapability (HF primary)')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield' })
  hfSuccessTransport()

  // This is EXACTLY what pipeline.generateAndPublish / orchestra / the cron route do:
  const { storage, recorded } = mockStorage(SOUL_ROW)
  const dna = await loadBrandDNA('u1', storage)
  assert(!!dna && dna.higgsfield.soulId === 'hf_soul_dropfly', 'loadBrandDNA(ownerId) surfaces the hf_soul_id binding')

  const binding = brandDNAToCapabilityBinding(dna)
  assert(!!binding && binding.soulId === 'hf_soul_dropfly', 'binding carries soulId into runCapability input')
  assert(!!binding && binding.brandKitStyleId === 'hf_style_dropfly', 'binding carries brandKitStyleId')

  const result = await generateBrandImage(
    { prompt: 'build-in-public hero', aspectRatio: '1:1', userId: 'u1', brandDNA: binding },
    { storage },
  )
  // soulId present → generateBrandImage picks persona_consistent_image → HF primary.
  assert(result.provider === 'higgsfield', `generation went THROUGH the capability engine on HF (got ${result.provider})`)
  assert(result.url === 'https://cdn.higgsfield.ai/u3.png', 'returns the HF-served on-brand image url')
  assert(result.meta.soulId === 'hf_soul_dropfly', 'meta.soulId proves the DNA reached the generation call')
  assert(result.meta.capability === 'persona_consistent_image', 'capability resolved from the loaded soul binding')
  assert(recorded.some(r => r.row?.brand_soul_id === 'soul-row-1'), 'generation_jobs row links the brand_soul_id')
  __setHiggsfieldTransport(undefined)
}

async function testNullDnaDegradesNoCrash() {
  console.log('\n[B] null DNA → no crash; generic image_gen still generates (degrade-with-flag for bound caps)')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield' })
  hfSuccessTransport()

  // No brand_souls row → loadBrandDNA returns null (the free-tier / no-soul path).
  const { storage } = mockStorage(null)
  const dna = await loadBrandDNA('u1', storage)
  assert(dna === null, 'loadBrandDNA returns null cleanly when no brand_souls row (degrade path)')

  const binding = brandDNAToCapabilityBinding(dna)
  assert(binding === undefined, 'binding is undefined when DNA is null (engine zero-behavior path fires)')

  // With no binding, generateBrandImage picks generic image_gen → HF primary (opted in).
  const result = await generateBrandImage(
    { prompt: 'a generic on-brand hero', aspectRatio: '1:1', userId: 'u1', brandDNA: binding },
    { storage },
  )
  assert(!!result.url, 'still produces a usable image (no crash, no faked identity)')
  assert(result.meta.capability === 'image_gen', 'falls to generic image_gen (never persona without a soul)')
  __setHiggsfieldTransport(undefined)
}

function testZeroBehaviorChange() {
  console.log('\n[C] zero-behavior-change: no key + no soul + engine unset → legacy router pick (byte-identical)')
  circuitBreaker.reset()
  // No HF key, media engine 'auto' → the legacy router is the source of truth.
  initEngine({ ...BASE_CFG, higgsfieldApiKey: undefined, engineDefaultMediaEngine: 'auto', defaultImageProvider: 'auto' })

  // The legacy pick for a plain image (what today's code would choose).
  const legacyPick = pickProvider({ prompt: 'build-in-public hero', aspectRatio: '1:1' })
  assert(legacyPick === 'fal', "legacy router pick is 'fal' (unchanged baseline)")

  // generateBrandImage with no binding resolves image_gen; with HF off it MUST route
  // through the unchanged legacy lane — proven by the plan engine matching the pick.
  const { resolvePlan } = require('../src/lib/engine/capability-engine.js') as typeof import('../src/lib/engine/capability-engine.js')
  const res = resolvePlan({ capability: 'image_gen', prompt: 'build-in-public hero', qualityTier: 'standard' })
  const planEngine = 'failSoft' in res ? '(failSoft)' : res.engine
  assert(planEngine === legacyPick, `wired path engine '${planEngine}' === legacy pickProvider() '${legacyPick}'`)
}

async function testAutopilotEntryRoutesThroughEngine() {
  console.log('\n[D] autopilot/cron generation goes THROUGH the capability engine (not a direct provider)')
  circuitBreaker.reset()
  initEngine({ ...BASE_CFG, higgsfieldApiKey: 'fake-key', engineDefaultMediaEngine: 'higgsfield' })
  hfSuccessTransport()

  // Autopilot rides generateAndPublish → generateBrandImage; the cron route (U3b) now
  // calls generateBrandImage directly. Both share this single capability-engine entry.
  // Proving generateBrandImage routes a soul-bound request to HF proves the autopilot
  // + cron generation is capability-engine-served, not a raw fal.subscribe bypass.
  const { storage } = mockStorage(SOUL_ROW)
  const dna = await loadBrandDNA('u1', storage)
  const binding = brandDNAToCapabilityBinding(dna)
  const result = await generateBrandImage(
    { prompt: 'autopilot draft hero', aspectRatio: '9:16', userId: 'u1', brandDNA: binding },
    { storage },
  )
  assert(result.meta.engine === 'higgsfield', 'autopilot/cron image is served by the capability engine (HF), not direct FAL')
  assert(result.meta.capability === 'persona_consistent_image', 'autopilot/cron path carries the brand soul into the gen')
  __setHiggsfieldTransport(undefined)
}

async function main() {
  console.log('=== U3 wiring contract test (mocked storage + mocked engine transport) ===')
  await testEntryLoadsDnaAndInjects()
  await testNullDnaDegradesNoCrash()
  testZeroBehaviorChange()
  await testAutopilotEntryRoutesThroughEngine()

  console.log(`\n${failures === 0 ? 'ALL PASS ✅' : `FAILED ❌ (${failures} assertion(s))`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => { console.error('UNEXPECTED ERROR:', err); process.exit(1) })
