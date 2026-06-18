#!/usr/bin/env npx tsx
/**
 * U2 CONTRACT TEST — Brand-DNA Soul Ledger (loader + writers).
 *
 * Pure, hermetic: a MOCKED SoulStorage (no DB, no creds) proves:
 *   (a) loadBrandDNA maps a fake brand_souls row → correct BrandDNA, including
 *       all four Higgsfield binding fields (soul / brand_kit / style / elements).
 *   (b) recordSoulMemory builds the correct soul_memory insert row.
 *   (c) generation_jobs idempotency_key conflict → upsert (onConflict), no throw.
 *   (d) loadBrandDNA returns null cleanly when no row exists.
 *
 * Run: npx tsx scripts/test-brand-dna.ts
 */

import {
  loadBrandDNA,
  recordSoulMemory,
  recordGenerationJob,
  __soulLedgerInternals,
} from '../src/lib/engine/brand.js'
import type { SoulStorage, SoulStorageQuery } from '../src/lib/engine/brand.js'

let failures = 0
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.error(`  ✗ ${label}`)
  }
}

/**
 * Build a mock SoulStorage that records the last call (table/op/row/conflict)
 * and returns a configurable row. Chainable to mirror the Supabase builder.
 */
function mockStorage(returnRow: Record<string, unknown> | null) {
  const calls: {
    table?: string
    op?: 'upsert' | 'insert'
    row?: Record<string, unknown>
    onConflict?: string
    eqs: [string, unknown][]
  } = { eqs: [] }

  const query: SoulStorageQuery = {
    select() { return query },
    eq(col, val) { calls.eqs.push([col, val]); return query },
    async maybeSingle() { return { data: returnRow, error: null } },
    async single() { return { data: returnRow, error: null } },
    upsert(row, opts) { calls.op = 'upsert'; calls.row = row; calls.onConflict = opts?.onConflict; return query },
    insert(row) { calls.op = 'insert'; calls.row = row; return query },
  }

  const storage: SoulStorage = {
    from(table) { calls.table = table; return query },
  }
  return { storage, calls }
}

const FAKE_SOUL_ROW: Record<string, unknown> = {
  id: 'soul-uuid-1',
  user_id: 'user-1',
  brand_name: 'DropFly',
  tagline: 'The AI Venture Studio That Builds & Ships Real Companies',
  one_liner: 'A pre-seed AI venture studio with its own build-machine.',
  positioning: 'Back the machine; get the portfolio.',
  voice: {
    tone: ['confident', 'builder/engineer', 'anti-hype'],
    do: ['show real shipped work', 'concrete numbers'],
    dont: ['buzzword slop', 'emoji spam'],
  },
  visual: {
    background: '#0A0D14',
    text: '#F5F6FA',
    brand_gradient: ['#3B62F6', '#7A4DF5', '#A24BEF'],
    aesthetic: ['cinematic', 'premium dark'],
    avoid: ['stock-photo vibe', 'cluttered'],
  },
  platform_policy: {
    primary: ['linkedin', 'twitter'],
    secondary: ['instagram', 'tiktok'],
    post_cadence_target: '5x/week supervised',
    ai_disclosure: 'required where platform/law mandates',
  },
  content_pillars: ['Build-in-public', 'Product spotlights'],
  audience: ['founders', 'operators', 'AI builders'],
  hf_soul_id: 'soul_abc',
  hf_brand_kit_id: 'kit_def',
  hf_brand_kit_style_id: 'style_ghi',
  hf_reference_element_ids: ['el_1', 'el_2'],
  created_at: '2026-06-16T00:00:00Z',
  updated_at: '2026-06-16T00:00:00Z',
}

async function testLoadMapping() {
  console.log('\n[A] loadBrandDNA maps a fake row → BrandDNA incl. all 4 HF binding fields')
  const { storage, calls } = mockStorage(FAKE_SOUL_ROW)

  const dna = await loadBrandDNA('user-1', storage)
  assert(dna !== null, 'returns a non-null BrandDNA')
  if (!dna) return

  assert(calls.table === 'brand_souls', 'queries the brand_souls table')
  assert(calls.eqs.some(([c, v]) => c === 'user_id' && v === 'user-1'), 'scopes by user_id (tenant isolation)')

  assert(dna.brandName === 'DropFly', 'maps brand_name')
  assert(dna.tagline?.startsWith('The AI Venture Studio') === true, 'maps tagline')
  assert(dna.positioning === 'Back the machine; get the portfolio.', 'maps positioning')
  assert(dna.voice.tone.includes('anti-hype'), 'maps voice.tone[]')
  assert(dna.voice.dont.includes('emoji spam'), 'maps voice.dont[]')
  assert(dna.visual.brandGradient.length === 3, 'maps visual.brand_gradient → brandGradient[]')
  assert(dna.visual.aesthetic.includes('premium dark'), 'maps visual.aesthetic[]')
  assert(dna.platformPolicy.primary.includes('linkedin'), 'maps platform_policy.primary[]')
  assert(dna.platformPolicy.postCadenceTarget === '5x/week supervised', 'maps post_cadence_target')
  assert(dna.contentPillars.length === 2, 'maps content_pillars[]')
  assert(dna.audience.includes('founders'), 'maps audience[]')

  // The four Higgsfield binding ids the engine injects:
  assert(dna.higgsfield.soulId === 'soul_abc', 'surfaces hf_soul_id')
  assert(dna.higgsfield.brandKitId === 'kit_def', 'surfaces hf_brand_kit_id')
  assert(dna.higgsfield.brandKitStyleId === 'style_ghi', 'surfaces hf_brand_kit_style_id')
  assert(
    dna.higgsfield.referenceElementIds.length === 2 &&
      dna.higgsfield.referenceElementIds[0] === 'el_1',
    'surfaces hf_reference_element_ids[]'
  )
}

async function testSoulMemoryInsertRow() {
  console.log('\n[B] recordSoulMemory builds the correct soul_memory insert row')
  const { storage, calls } = mockStorage({ id: 'mem-1' })

  await recordSoulMemory(
    {
      userId: 'user-1',
      brandSoulId: 'soul-uuid-1',
      generationJobId: 'job-1',
      platform: 'linkedin',
      niche: 'ai-venture',
      format: 'reel',
      hookType: 'pattern_interrupt',
      opener: 'Most AI studios ship slideware. We ship companies.',
      audioId: 'audio_x',
      captionStyle: 'declarative',
      lengthSeconds: 28,
      postTime: '2026-06-16T18:00:00Z',
      capability: 'persona_consistent_video',
      model: 'seedance_2_0',
      metrics: { views: 1200, retention: 0.62, likes: 88, shares: 14, conversions: 3 },
    },
    storage
  )

  assert(calls.table === 'soul_memory', 'inserts into soul_memory')
  assert(calls.op === 'insert', 'uses insert (append-only ledger)')
  const r = calls.row!
  assert(r.user_id === 'user-1', 'row.user_id set (owner)')
  assert(r.brand_soul_id === 'soul-uuid-1', 'row.brand_soul_id set (fk)')
  assert(r.generation_job_id === 'job-1', 'row.generation_job_id set')
  assert(r.platform === 'linkedin', 'row.platform set')
  assert(r.hook_type === 'pattern_interrupt', 'snake_cases hookType → hook_type')
  assert(r.caption_style === 'declarative', 'snake_cases captionStyle → caption_style')
  assert(r.length_seconds === 28, 'snake_cases lengthSeconds → length_seconds')
  assert(r.capability === 'persona_consistent_video', 'records capability (capability-first)')
  assert(r.model === 'seedance_2_0', 'records concrete model')
  assert((r.metrics as Record<string, unknown>).views === 1200, 'nests metrics jsonb')

  // Also exercise the pure builder directly (no storage).
  const built = __soulLedgerInternals.soulMemoryRow({
    userId: 'u', brandSoulId: 's', platform: 'tiktok',
  })
  assert(built.metrics !== undefined, 'builder defaults metrics to {} when omitted')
  assert(built.generation_job_id === undefined, 'builder omits unset optional columns')
}

async function testGenerationJobIdempotency() {
  console.log('\n[C] generation_jobs idempotency_key → upsert (onConflict), no throw')
  const { storage, calls } = mockStorage({ id: 'job-1', status: 'pending' })

  let threw = false
  try {
    await recordGenerationJob(
      {
        userId: 'user-1',
        capability: 'persona_consistent_image',
        model: 'soul_2',
        mediaType: 'image',
        idempotencyKey: 'user-1:soul_2:2026-06-16T18:00',
        hfJobId: 'hf_999',
        params: { prompt: 'on-brand hero still' },
      },
      storage
    )
  } catch {
    threw = true
  }

  assert(!threw, 'does not throw on a keyed (retry-safe) write')
  assert(calls.table === 'generation_jobs', 'targets generation_jobs')
  assert(calls.op === 'upsert', 'uses upsert when idempotency_key present (no double-spend)')
  assert(calls.onConflict === 'idempotency_key', 'upserts onConflict=idempotency_key')
  const r = calls.row!
  assert(r.engine === 'higgsfield', 'defaults engine to higgsfield')
  assert(r.capability === 'persona_consistent_image', 'records capability')
  assert(r.media_type === 'image', 'snake_cases mediaType → media_type')
  assert(r.idempotency_key === 'user-1:soul_2:2026-06-16T18:00', 'carries idempotency_key')

  // No key → plain insert (not upsert).
  const { storage: s2, calls: c2 } = mockStorage({ id: 'job-2' })
  await recordGenerationJob({ userId: 'u', capability: 'image_gen', model: 'nano_banana_pro' }, s2)
  assert(c2.op === 'insert', 'falls back to insert when no idempotency_key')
}

async function testLoadNullWhenNoRow() {
  console.log('\n[D] loadBrandDNA returns null cleanly when no row')
  const { storage } = mockStorage(null)
  const dna = await loadBrandDNA('user-without-soul', storage)
  assert(dna === null, 'returns null (degrade-with-flag path can fire)')
}

async function main() {
  console.log('=== U2 Brand-DNA Soul Ledger contract test (mocked storage) ===')
  await testLoadMapping()
  await testSoulMemoryInsertRow()
  await testGenerationJobIdempotency()
  await testLoadNullWhenNoRow()

  console.log(`\n${failures === 0 ? 'ALL PASS ✅' : `FAILED ❌ (${failures} assertion(s))`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('UNEXPECTED ERROR:', err)
  process.exit(1)
})
