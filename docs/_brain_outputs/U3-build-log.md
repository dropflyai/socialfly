# U3 BUILD LOG — Brand-DNA + capability-engine wired into the real entry points + autopilot

**Brain:** BACKEND (x1000) · **Date:** 2026-06-17 · **Rung:** U3 (under the Incremental Build Gate)
**Scope (ONE increment):** wire `loadBrandDNA` into the generation entry points + re-point
autopilot/cron generation through the capability engine + verify. NOT built (deferred):
U4 virality gate, trend ingestion, AI mentor, HF video provider.

---

## What was already in place (from U2 wiring) vs what U3 added

- **Already wired (U2 rung):** `pipeline.generateAndPublish` and `orchestra.orchestrateContent`
  already `loadBrandDNA(userId)` → `brandDNAToCapabilityBinding` → `generateBrandImage` →
  `runCapability`. The prior `pipeline.generateImage()` direct-FAL bypass was ALREADY
  re-pointed onto `generateBrandImage` in the `includeImage` branch.
- **U3 added this rung:** (1) re-pointed the `/api/cron/automations` inline image bypass
  (U3b); (2) confirmed + proved the autopilot surface rides the capability engine;
  (3) threaded `persist` through `generateBrandImage`; (4) the U3 contract test + live proof.

## Files changed / added

- **`src/app/api/cron/automations/route.ts`** (CHANGED — U3b, the second bypass surface).
  The inline image generation (was a raw `fal.subscribe('fal-ai/flux/schnell')` that
  bypassed every router) now loads the tenant's Brand DNA via `loadBrandDNA(rule.user_id)`
  and generates through `generateBrandImage()` → `runCapability`. Kept: the credit
  deduction, the `buildFullPrompt` prompt-engineer step, the platform→aspect mapping, and
  the same try/catch fail-soft (a gen failure leaves `imageUrl=null`, post still saves).
- **`src/lib/engine/capability-engine.ts`** (ADDITIVE) — added optional `persist?: boolean`
  to `BrandImageRequest` and forwarded it into the `CapabilityRequest`, so the entry helper
  can run storage-free in CLI proofs (default stays `true` for production).
- **`scripts/test-u3-wiring.ts`** (NEW) — mocked-storage + mocked-transport contract test.
- **`scripts/run-u3-live.ts`** (NEW) — the ONE live proof (DropFly Brand DNA, real gen).
- **`docs/proofs/u3-dropfly-onbrand.png`** (NEW) — the live on-brand proof image.

## Bypass-surface disposition (the two RESPEC §1.1 surfaces)

1. **`pipeline.generateImage()` (direct FAL)** — RE-POINTED. The `includeImage` branch of
   `generateAndPublish` calls `generateBrandImage` (capability engine); the bare
   `generateImage` from `generate.ts` is now only the last-resort fallback when the engine
   returns no media (queued/gate-skipped). LOW-RISK, done.
2. **`/api/cron/automations` inline image gen** — RE-POINTED this rung (U3b). LOW-RISK:
   with no brand_souls row + no HF key + engine unset, `generateBrandImage` → `runCapability`
   resolves to the UNCHANGED legacy FAL lane (`smartGenerateImage`) → byte-identical to the
   old raw `fal.subscribe`. When a Soul/HF key IS present it generates on-brand on HF.
   **FOLLOW-UP (left intentionally):** the cron route's `fal.subscribe(kling-video i2v)` VIDEO
   lane (line ~602) is NOT re-pointed — there is no HF video provider wired yet (later rung),
   so re-pointing it would be a no-op detour. Reason logged here, not broken.

## Zero-behavior-change discipline

Holds. With `HIGGSFIELD_API_KEY` absent + `engineDefaultMediaEngine='auto'` + no `brand_souls`
row: `loadBrandDNA` returns `null` → `brandDNAToCapabilityBinding` returns `undefined` →
`generateBrandImage` picks `image_gen` → `resolvePlan` takes the legacy-router branch →
the chosen engine equals today's `pickProvider()` (`'fal'`). Proven byte-identical in test [C].

## Verify results (E2E gate)

- **`npx tsc --noEmit`** → 79 errors total, **0 in src/** (baseline 79, all in `tests/*.spec.ts`
  pre-existing implicit-any `page`). Zero NEW src errors from U3.
- **`npm run build`** → **exit 0**, "✓ Compiled successfully in 3.2s", full route table built
  (dummy env, same approach as U0/U2).
- **All existing tests pass:** `test-higgsfield-provider` ✅, `test-brand-dna` ✅,
  `test-capability-engine` ✅.
- **`scripts/test-u3-wiring.ts`** → **ALL PASS ✅ (16 assertions)**:
  - [A] entry chain `loadBrandDNA(ownerId)` → binding → `generateBrandImage` → `runCapability`
    served by HF; `meta.soulId` proves the DNA reached the gen; `generation_jobs` links
    `brand_soul_id`; capability resolved from the loaded soul.
  - [B] null DNA → no crash; falls to generic `image_gen` (never persona without a soul).
  - [C] zero-behavior-change: no key + no soul + engine unset → plan engine === legacy
    `pickProvider()` (`'fal'`), byte-identical.
  - [D] autopilot/cron generation goes THROUGH the capability engine (HF), not a direct provider.

## Mock-proven vs live-proven vs needs-live-DB

- **Mock-proven (no DB, no network):** the full wiring chain (loadBrandDNA→binding→
  generateBrandImage→runCapability), DNA injection into the gen, null-DNA degrade-no-crash,
  zero-behavior-change, and that autopilot/cron generation is capability-engine-served.
- **LIVE-PROVEN (the customer #0 moment):** ONE real image generation through the production
  entry point `generateBrandImage()` → `runCapability`. **Served by `higgsfield`** (nano_banana_pro
  via the Soul t2i REST surface), **18.1s**, **~2 credits (estimate; cheapest 720p / batch 1
  / persist:false)**. DropFly Brand DNA injected (soul_id=null → navy #0A0D14 background +
  indigo→violet→purple gradient + cinematic premium-dark aesthetic folded into the prompt —
  NOT faked identity, `meta.degraded=(none)` because generic `image_gen` is not DNA-bound).
  A real build-in-public hero (NOT the apple test prompt). Saved 1.45MB →
  `docs/proofs/u3-dropfly-onbrand.png`. Visual confirms on-brand: luminous gradient arc on
  deep navy, clean negative space.
- **Needs live DB (DEFERRED, same as prior rungs):** the `generation_jobs` + `soul_memory`
  writes (`recordGenerationJob`/`recordSoulMemory`) require real Supabase + migration 020
  applied. Mock-proven row shapes here; the autopilot dry-run that writes a real
  `soul_memory`/`generation_jobs` row + RLS tenant isolation are deferred to a live-DB run.
  The live proof passed no `userId`, so accounting was intentionally skipped.

## Open items for U4 (virality gate) + beyond

- **U4 virality gate (predict-cheap → generate-premium):** add `virality_predict` into the
  autopilot path (RESPEC §4.5). The capability + fail-soft (`gate_skipped`) plumbing already
  exists in `capability-engine.ts`; U4 wires the two-phase flow, not new engine code.
- **HF video provider:** `runOnEngine` routes `video_gen`/`persona_consistent_video` through
  the existing FAL `smartGenerateVideo` (no HF video lane yet). Until `higgsfieldGenerateVideo`
  lands, the cron route's Kling i2v video bypass stays (logged above) and autopilot video is
  FAL-served. Wire HF video before flipping video onto the engine.
- **Live-DB autopilot dry-run:** apply migration 020, seed a `brand_souls` row with a real
  `hf_soul_id`, run autopilot draft → assert a `soul_memory` + `generation_jobs` row is
  written and RLS isolates the tenant (RESPEC U3 E2E gate's DB half).
- **`ENGINE_DEFAULT_MEDIA_ENGINE='higgsfield'` flip:** the wiring honors the flag; flipping it
  in staging/prod is the operational step (kill-switch = unset → reverts to legacy router).
