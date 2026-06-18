#!/usr/bin/env npx tsx
/**
 * U0 CONTRACT TEST — HiggsfieldProvider (image) behind the image-router seam.
 *
 * Pure, hermetic: a MOCKED transport (no real network, no key needed) proves:
 *   (a) provider submits → polls → returns a normalized GeneratedImage on success
 *   (b) on a missing key it throws the typed HF_NO_KEY fallback error
 *   (c) image-router still picks the existing default provider ('fal') when
 *       Higgsfield is NOT opted-in — proving ZERO behavior change.
 *
 * Run: npx tsx scripts/test-higgsfield-provider.ts
 */

import { initEngine } from '../src/lib/engine/config.js'
import {
  higgsfieldGenerateImage,
  HiggsfieldError,
  __setHiggsfieldTransport,
} from '../src/lib/engine/providers/higgsfield.js'
import { pickProvider, scoreProviders } from '../src/lib/engine/image-router.js'

let failures = 0
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.error(`  ✗ ${label}`)
  }
}

/** Build a minimal mock Response. */
function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

async function testSuccess() {
  console.log('\n[A] submit → poll → normalized result on success')

  // Engine config WITH a (fake) key, so submitAndPoll proceeds.
  initEngine({
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'svc',
    anthropicApiKey: 'a',
    falApiKey: 'f',
    higgsfieldApiKey: 'fake-key-not-real',
    higgsfieldApiSecret: 'fake-secret-not-real', // live API needs a key:secret pair (U0 live-verify)
    higgsfieldTimeoutMs: 5_000,
  })

  // First call = POST submit → returns id + status:processing.
  // Second call = GET poll → returns status:completed with image url.
  let call = 0
  __setHiggsfieldTransport(async (_url, init) => {
    call++
    const method = (init?.method ?? 'GET').toUpperCase()
    if (call === 1) {
      assert(method === 'POST', 'first call is a POST submit')
      // VERIFIED response shape (higgsfield-js V1 JobSet): { id, jobs:[{status, results}] }.
      return mockResponse({ id: 'job_123', jobs: [{ id: 'j0', status: 'in_progress', results: null }] })
    }
    // poll GET /v1/job-sets/{id} → JobSet with a completed job carrying results.raw.url.
    return mockResponse({
      id: 'job_123',
      jobs: [
        {
          id: 'j0',
          status: 'completed',
          results: { raw: { url: 'https://cdn.higgsfield.ai/out/job_123.png', type: 'image' } },
        },
      ],
    })
  })

  // persist:false keeps it hermetic (no Supabase storage round-trip).
  // maxWaitMs short; poll interval is 5s, but the mock completes on the 2nd call,
  // which happens after one sleep — acceptable for the contract test.
  const result = await higgsfieldGenerateImage('a cozy coffee shop', '1:1', { persist: false })

  assert(result.url === 'https://cdn.higgsfield.ai/out/job_123.png', 'returns the completed image url')
  assert(result.prompt === 'a cozy coffee shop', 'echoes the prompt')
  assert(typeof result.enhancedPrompt === 'string', 'has enhancedPrompt (normalized shape)')
  assert(call === 2, 'made exactly one submit + one poll')

  __setHiggsfieldTransport(undefined)
}

async function testMissingKey() {
  console.log('\n[B] missing key → typed HF_NO_KEY fallback error')

  initEngine({
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'svc',
    anthropicApiKey: 'a',
    falApiKey: 'f',
    // No higgsfieldApiKey, and ensure env doesn't smuggle one in.
    higgsfieldApiKey: undefined,
  })

  // Transport should NEVER be hit when the key is missing.
  let hit = false
  __setHiggsfieldTransport(async () => { hit = true; return mockResponse({}) })

  let caught: unknown
  try {
    await higgsfieldGenerateImage('test', '1:1', { persist: false })
  } catch (err) {
    caught = err
  }

  assert(caught instanceof HiggsfieldError, 'throws a HiggsfieldError')
  assert(caught instanceof HiggsfieldError && caught.code === 'HF_NO_KEY', 'error code is HF_NO_KEY')
  assert(!hit, 'transport never called without a key')

  __setHiggsfieldTransport(undefined)
}

function testZeroBehaviorChange() {
  console.log('\n[C] router unchanged when Higgsfield NOT opted-in')

  // No higgsfieldApiKey, no DEFAULT_IMAGE_PROVIDER → behavior must match pre-U0.
  initEngine({
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'svc',
    anthropicApiKey: 'a',
    falApiKey: 'f',           // only FAL configured
    higgsfieldApiKey: undefined,
    defaultImageProvider: 'auto',
  })

  const req = { prompt: 'a sunset over mountains', aspectRatio: '1:1' as const }
  const scores = scoreProviders(req)
  const picked = pickProvider(req)

  assert(!scores.some(s => s.provider === 'higgsfield'), 'higgsfield NOT in the scored list')
  assert(picked === 'fal', `default pick is 'fal' (got '${picked}')`)

  // Sanity: when opted-in, higgsfield DOES enter and wins (proves the wiring works,
  // and that the gate above is the only thing keeping it out).
  initEngine({
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'svc',
    anthropicApiKey: 'a',
    falApiKey: 'f',
    higgsfieldApiKey: 'fake-key',
    defaultImageProvider: 'auto',
  })
  const optedScores = scoreProviders(req)
  assert(optedScores.some(s => s.provider === 'higgsfield'), 'higgsfield enters the list once key is set')
  assert(pickProvider(req) === 'higgsfield', 'higgsfield wins when opted-in (primary bump)')
}

async function main() {
  console.log('=== U0 HiggsfieldProvider contract test (mocked transport) ===')
  await testSuccess()
  await testMissingKey()
  testZeroBehaviorChange()

  console.log(`\n${failures === 0 ? 'ALL PASS ✅' : `FAILED ❌ (${failures} assertion(s))`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('UNEXPECTED ERROR:', err)
  process.exit(1)
})
