#!/usr/bin/env npx tsx
/**
 * U0 LIVE-VERIFY (FINAL) — ONE real image generation through the PRODUCTION
 * HiggsfieldProvider code path (cheapest config: Soul t2i, 720p, batch_size 1).
 *
 * Proves submit → poll → normalized GeneratedImage with a real URL, then downloads
 * the image to docs/proofs/u0-live.png. persist:false so no Supabase round-trip.
 *
 * COST GATE: exactly ONE generation. Run: npx tsx scripts/run-higgsfield-live.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { initEngine } from '../src/lib/engine/config.js'
import { higgsfieldGenerateImage } from '../src/lib/engine/providers/higgsfield.js'

function envVal(name: string): string | undefined {
  const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  return raw.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm'))?.[1]?.trim() || undefined
}

async function main() {
  initEngine({
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'svc',
    anthropicApiKey: 'a',
    falApiKey: 'f',
    higgsfieldApiKey: envVal('HIGGSFIELD_API_KEY'),
    higgsfieldApiSecret: envVal('HIGGSFIELD_API_SECRET'),
    higgsfieldTimeoutMs: 240_000,
  })

  console.log('Submitting ONE Soul t2i generation (720p, batch 1, cheapest)...')
  const t0 = Date.now()
  const img = await higgsfieldGenerateImage(
    'a single ripe red apple on a plain white background, studio product photo',
    '1:1',
    { quality: '720p', persist: false }
  )
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`DONE in ${secs}s`)
  console.log('Result URL:', img.url)

  // Download the proof image.
  const res = await fetch(img.url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(join(process.cwd(), 'docs/proofs'), { recursive: true })
  const out = join(process.cwd(), 'docs/proofs/u0-live.png')
  writeFileSync(out, buf)
  console.log(`Saved ${buf.length} bytes → ${out}`)
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
