#!/usr/bin/env npx tsx
/**
 * U3 LIVE PROOF — the "customer #0" moment.
 *
 * Injects DropFly's OWN Brand DNA (from docs/brand-dna-dropfly.md) and runs ONE
 * real image generation through the PRODUCTION ENTRY POINT the autopilot/pipeline/
 * cron now share — generateBrandImage() → runCapability() → resolvePlan →
 * executeWithCascade → the U0 Higgsfield provider.
 *
 * DropFly's soul_id / brand_kit_id are NULL (a brand, not a trained face — see the
 * brand-dna doc note). So on-brand-ness is achieved EXACTLY as the degrade-with-flag
 * path intends: the palette (navy bg + indigo→violet→purple gradient), voice, and
 * cinematic-premium-dark aesthetic are folded into the PROMPT. No fake identity.
 *
 * Cheapest config: Soul t2i, 720p, batch_size 1 (~1 credit). persist:false (raw HF
 * URL, no Supabase dependency in this CLI run).
 *
 * COST GATE: exactly ONE generation. Run: npx tsx scripts/run-u3-live.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { initEngine } from '../src/lib/engine/config.js'
import { generateBrandImage } from '../src/lib/engine/capability-engine.js'
import type { CapabilityBrandDNA } from '../src/lib/engine/types.js'

function envVal(name: string): string | undefined {
  const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  return raw.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm'))?.[1]?.trim() || undefined
}

// ── DropFly Brand DNA, built INLINE from docs/brand-dna-dropfly.md ──────────────
// soul_id / brand_kit_id are null (brand, not a trained twin yet) → on-brand-ness
// comes from the palette/voice/aesthetic folded into the prompt below.
const DROPFLY_DNA: CapabilityBrandDNA = {
  brandSoulId: null,
  soulId: null,            // no trained Soul yet (per brand-dna-dropfly.md)
  brandKitId: null,        // no HF brand kit minted yet
  brandKitStyleId: null,
  referenceElementIds: [],
  imageStyle: 'cinematic, premium dark, high-craft, architectural/engineered, luminous gradient light on black, clean negative space',
}

// A real DropFly content idea (build-in-public hero) — NOT the apple test prompt.
// The visual DNA (navy #0A0D14 background, indigo→violet→purple gradient, premium
// dark cinematic) is folded directly into the prompt so the image is on-brand by
// construction even with no Soul.
const DROPFLY_PROMPT = [
  'Cinematic build-in-public hero image for DropFly, an AI venture studio.',
  'A sleek, architectural, engineered visual: luminous flowing gradient light streaks',
  'in indigo-blue (#3B62F6) into violet (#7A4DF5) into purple (#A24BEF),',
  'arcing across a near-black deep-navy background (#0A0D14).',
  'Premium dark aesthetic, high-craft, clean negative space, glowing edge-light,',
  'a sense of a precise machine shipping real software. No text, no logos, no clutter.',
  'Editorial, confident, anti-slop — the opposite of generic SaaS stock art.',
].join(' ')

async function main() {
  initEngine({
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'svc',
    anthropicApiKey: 'a',
    falApiKey: envVal('FAL_KEY') || 'f',
    higgsfieldApiKey: envVal('HIGGSFIELD_API_KEY'),
    higgsfieldApiSecret: envVal('HIGGSFIELD_API_SECRET'),
    higgsfieldTimeoutMs: 240_000,
    // Opt Higgsfield in as the media default so the entry point routes to HF primary.
    engineDefaultMediaEngine: 'higgsfield',
  })

  console.log('=== U3 LIVE PROOF — DropFly on-brand image through the production entry point ===')
  console.log('Entry point   : generateBrandImage() → runCapability() (the autopilot/pipeline/cron path)')
  console.log('Brand DNA     : DropFly (soul_id=null → palette/voice/aesthetic folded into prompt)')
  console.log('Config        : Soul t2i, 720p, batch_size 1, persist:false (cheapest)\n')

  const t0 = Date.now()
  const result = await generateBrandImage({
    prompt: DROPFLY_PROMPT,
    aspectRatio: '1:1',
    qualityTier: 'standard',   // routes to the HF primary (draft would prefer FAL)
    brandDNA: DROPFLY_DNA,
    persist: false,            // CLI proof: raw HF URL, no Supabase dependency
    // no userId → recordGenerationJob skipped (no DB in this CLI run)
  })
  const secs = ((Date.now() - t0) / 1000).toFixed(1)

  console.log(`DONE in ${secs}s`)
  console.log('Served by engine :', result.provider)
  console.log('meta.engine      :', result.meta.engine)
  console.log('meta.capability  :', result.meta.capability)
  console.log('meta.model       :', result.meta.model)
  console.log('meta.creditsSpent:', result.meta.creditsSpent, '(estimate)')
  console.log('meta.degraded    :', result.meta.degraded ?? '(none)')
  console.log('Result URL       :', result.url)

  if (!result.url) throw new Error('entry point returned no url (live proof failed)')

  const res = await fetch(result.url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(join(process.cwd(), 'docs/proofs'), { recursive: true })
  const out = join(process.cwd(), 'docs/proofs/u3-dropfly-onbrand.png')
  writeFileSync(out, buf)
  console.log(`\nSaved ${buf.length} bytes → ${out}`)
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
