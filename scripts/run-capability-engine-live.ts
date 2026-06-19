#!/usr/bin/env npx tsx
/**
 * U1 LIVE-VERIFY — ONE real image generation through the FULL capability-engine
 * stack (NOT the bare provider). Calls runCapability({ capability:'image_gen', ... })
 * → resolvePlan → executeWithCascade → the U0 Higgsfield provider, cheapest config
 * (Soul t2i, 720p, batch_size 1). Proves the whole capability layer works live and
 * reports WHICH engine served the request + the (estimated) credits.
 *
 * Mirrors scripts/run-higgsfield-live.ts but one rung up the stack.
 *
 * COST GATE: exactly ONE generation. Run: npx tsx scripts/run-capability-engine-live.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { initEngine } from '../src/lib/engine/config.js'
import { runCapability } from '../src/lib/engine/capability-engine.js'
import type { CapabilityRequest } from '../src/lib/engine/types.js'

function envVal(name: string): string | undefined {
  const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  return raw.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm'))?.[1]?.trim() || undefined
}

async function main() {
  initEngine({
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'svc',
    anthropicApiKey: 'a',
    falApiKey: envVal('FAL_KEY') || 'f',
    higgsfieldApiKey: envVal('HIGGSFIELD_API_KEY'),
    higgsfieldApiSecret: envVal('HIGGSFIELD_API_SECRET'),
    higgsfieldTimeoutMs: 240_000,
    // Opt Higgsfield in as the media default so the capability engine routes
    // image_gen to the HF primary (else it would take the byte-identical legacy lane).
    engineDefaultMediaEngine: 'higgsfield',
  })

  const req: CapabilityRequest = {
    capability: 'image_gen',
    prompt: 'a single ripe red apple on a plain white background, studio product photo',
    format: { aspectRatio: '1:1' },
    // 'standard' tier routes to the HIGGSFIELD primary (draft would pick FAL as the
    // cheapest engine). The Soul t2i call is itself the cheapest config (720p, batch 1)
    // regardless of tier — tier only affects the credit ESTIMATE, not the live request.
    qualityTier: 'standard',
    // CLI proof: do NOT persist to Supabase (dummy creds here). Return the raw HF URL;
    // a persist failure must never be mistaken for a generation failure.
    persist: false,
    // no userId → accounting (recordGenerationJob) is skipped (no DB in this CLI run).
  }

  console.log('Running ONE image_gen through runCapability (cheapest: 720p, batch 1)...')
  const t0 = Date.now()
  const result = await runCapability(req)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)

  console.log(`DONE in ${secs}s`)
  console.log('Served by engine :', result.provider)
  console.log('meta.engine      :', result.meta.engine)
  console.log('meta.model       :', result.meta.model)
  console.log('meta.creditsSpent:', result.meta.creditsSpent, '(estimate)')
  console.log('meta.degraded    :', result.meta.degraded ?? '(none)')
  console.log('Result URL       :', result.url)

  if (!result.url) throw new Error('capability-engine returned no url')

  // Download the proof image.
  const res = await fetch(result.url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(join(process.cwd(), 'docs/proofs'), { recursive: true })
  const out = join(process.cwd(), 'docs/proofs/capability-engine-live.png')
  writeFileSync(out, buf)
  console.log(`Saved ${buf.length} bytes → ${out}`)
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
