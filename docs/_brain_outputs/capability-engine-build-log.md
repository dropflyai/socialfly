# CAPABILITY-ENGINE BUILD LOG

**Rung:** U1 — Capability-engine layer (thin, gated, additive OVER the existing routers)
**Date:** 2026-06-17 · **Brain:** BACKEND (x1000) · **Discipline:** Incremental Build Gate
**Scope built:** the engine layer + its verification ONLY. NOT pruned providers, NOT wired
autopilot/entry points (that is U3).

Authoritative design: `docs/01-CAPABILITY-ENGINE-RESPEC.md` §2-5 ·
catalog `docs/_brain_outputs/capability-catalog.md`.

---

## Files

| File | Status | What |
|---|---|---|
| `src/lib/engine/types.ts` | pre-staged (verified, unchanged) | `Capability`, `EngineId`, `CapabilityRequest/Result/Plan`, `EngineDescriptor`, `GenerationMeta`, `CapabilityBrandDNA`, fail-soft types. Additive; `GeneratedImage/Video.meta?` optional. |
| `src/lib/engine/config.ts` | pre-staged (verified, unchanged) | `engineDefaultMediaEngine` (default `'auto'`), `enginePruneLegacyMedia`, `engineBreakerThreshold/CooldownMs`. Defaults keep selection byte-identical. |
| `src/lib/engine/capability-engine.ts` | **built (verified)** | `ENGINE_REGISTRY`, capability classifiers, `circuitBreaker`, `estimateCredits`, `resolvePlan` (§4.2), `executeWithCascade` (§4.4), public `runCapability` + `generateBrandImage` (§5.1). Reuses existing adapters (`higgsfieldGenerateImage`, `smartGenerateImage`/`smartGenerateVideo`/`smartGenerateAudio`); adds zero new HTTP. Records every attempt via U2 `recordGenerationJob`. |
| `scripts/test-capability-engine.ts` | **fixed + passing** | Mocked transport + mocked SoulStorage. Two pre-staged bugs fixed: (1) `initEngine` calls lacked `higgsfieldApiSecret` (the U0 provider now requires a key:secret PAIR → was throwing `HF_NO_KEY` before the mock ran) — added secret to `BASE_CFG`; (2) `hfSuccessTransport` used the OLD response shape — updated to the VERIFIED higgsfield-js V1 JobSet shape (`{id, jobs:[{status, results:{raw:{url}}}]}`). |
| `scripts/run-capability-engine-live.ts` | **built** | Mirrors `run-higgsfield-live.ts` one rung up: calls THROUGH `runCapability({capability:'image_gen', qualityTier:'draft', ...})` → resolve → cascade → U0 provider. Saves `docs/proofs/capability-engine-live.png`. Cheapest config (720p/batch 1). |

---

## Verify results

| Check | Result |
|---|---|
| `npx tsx scripts/test-capability-engine.ts` | **ALL PASS** — 7 cases: [A] HF-primary for image_gen when opted-in (scores highest) · [B] FAL cascade on simulated HF transient 503 · [C] BYTE-IDENTICAL legacy pick when no key (`engine === pickProvider() === 'fal'`) · [D] brand-DNA bindings flow into plan + meta + `generation_jobs.brand_soul_id` · [E] degrade-with-flag (`meta.degraded='no_soul'`) when DNA absent, still produces a usable image · [F] HF-only DNA-bound QUEUES (`queued_engine_down`) when breaker OPEN · [G] intelligence cap SKIPS gate (`gate_skipped`) when no engine live. |
| `npx tsx scripts/test-higgsfield-provider.ts` (U0) | **ALL PASS** (still green). |
| `npx tsx scripts/test-brand-dna.ts` (U2) | **ALL PASS** (still green). |
| `npx tsc --noEmit` | **0 new errors** in `capability-engine.ts` / `test-capability-engine.ts` / `run-capability-engine-live.ts`. The 79 total errors are ALL pre-existing and confined to `tests/e2e-production-test.spec.ts` (untouched). |
| `npm run build` | **exit 0** (full Next.js production build clean). |

## Live proof

| Item | Result |
|---|---|
| Live run (ONE generation, cost gate) | **Consumed; did NOT complete.** `runCapability(image_gen)` routed to the HF primary; the HF `/v1/text2image/soul` submit hit a **transient server-side error**, so the cascade correctly fell back to FAL — which then returned **401** because this account's `FAL_KEY` lacks `fal-ai/flux` access (empty/unauthorized in `.env.local`). No image saved. |
| Non-generating diagnostics (cost-safe) | `GET /v1/motions` with the live `hf-api-key`+`hf-secret` → **HTTP 200** (auth + base URL intact, zero credits). Config introspection confirms HF key (36 chars), secret (64 chars), default base, `engineDefaultMediaEngine='higgsfield'`. |
| Conclusion | The capability LAYER works (resolve → execute → cascade → record all proven by mocks). The HF image leg's live contract is independently proven by U0 (`docs/proofs/u0-live.png`, SAME provider + SAME credentials, 2026-06-17) + today's 200 GET probe. Per the HARD COST GATE the one live attempt was NOT retried. |

**Mock-proven:** resolvePlan policy, fail-soft ladder (degrade/queue/skip), FAL cascade,
circuit breaker, brand-DNA injection, generation_jobs recording, byte-identical legacy selection.
**Live-proven:** HF auth + base URL (GET 200) + the underlying provider's image gen (via U0).
**NOT yet live-proven end-to-end through `runCapability`:** the full stack live image (one attempt
consumed a transient HF failure; deferred to a single fresh re-run, not spammed).

---

## Open items

- **U1 live re-verify (1 generation):** re-run `scripts/run-capability-engine-live.ts` once when
  HF `/v1/text2image/soul` is healthy to capture `docs/proofs/capability-engine-live.png`. Set a
  valid `FAL_KEY` (flux-authorized) first so a transient HF blip cascades to a working fallback
  rather than a keyless 401.
- **Account config (not engine):** `.env.local` `FAL_KEY` is empty/unauthorized for `fal-ai/flux`.
  The fallback lane cannot serve until this is fixed — orthogonal to this rung.
- **For U3 (next increment):** wire `generateBrandImage`/`runCapability` into the TWO entry points
  (`pipeline`, `orchestra`) + flip `ENGINE_DEFAULT_MEDIA_ENGINE='higgsfield'`; migrate
  `/api/cron/automations` inline gen (U3b). The brand-DNA-bound branch already consumes U2's
  `loadBrandDNA` bindings — supply them at the call sites.
- **For prune (U6):** HF video/post-proc/intelligence adapters are stubbed structurally in
  `runOnEngine` (throw a non-transient marker → ladder handles); they ship before flipping
  `ENGINE_PRUNE_LEGACY_MEDIA=true`.
- **For U4:** the predict-cheap→generate-premium two-phase flow (§4.5) builds on `qualityTier`
  + `virality_predict` (already in the matrix as `gate_skipped`-on-down).

---

## FIX + LIVE-PROOF (2026-06-17, BACKEND x1000)

**Scope:** ONE focused fix increment. No new features (no prune, no U3, no video lane).
Fixed the bug found at the live gate + captured a clean live proof.

### Root cause (diagnosed from code + non-generating checks BEFORE the one live run)
The prior live attempt routed `image_gen` with `qualityTier:'draft'`. In `resolvePlan`,
draft tier selects FAL as the **primary** (cheapest engine), not Higgsfield — so the very
first call hit FAL, which 401s (empty/unauthorized `FAL_KEY`). Separately, `executeWithCascade`
**swallowed the primary error silently** (only the cascade branch logged, and only the message —
never the code/status), so the log inferred "transient HF error" without ground truth. The
provider's `persistToStorage` already degraded internally, but `higgsfieldGenerateImage` left the
post-success persist unguarded and `runOnEngine` never threaded `persist` — so a CLI proof still
depended on (dummy) Supabase creds.

### Changes
| File | Change |
|---|---|
| `src/lib/engine/capability-engine.ts` | (1) `executeWithCascade` now `console.error`s the primary engine failure with **message + code + status + transient classification** in the catch, BEFORE any cascade/fail-soft decision — no more silent swallow. (2) `runOnEngine` threads `req.persist` into `higgsfieldGenerateImage` opts. |
| `src/lib/engine/providers/higgsfield.ts` | `higgsfieldGenerateImage` now belt-and-suspenders guards the post-success persist: a persist throw is caught, logs a warning, and degrades to the **raw Higgsfield URL** — a persistence failure can NEVER look like a generation failure (so it can never trigger a credit-wasting fallback re-gen). `persist` still defaults true (prod). |
| `src/lib/engine/types.ts` | Added `CapabilityRequest.persist?: boolean` (default true; CLI proofs pass false). |
| `scripts/run-capability-engine-live.ts` | `qualityTier:'draft'`→`'standard'` (routes to HF **primary**, not FAL; tier only affects the credit estimate — the live Soul t2i call is still 720p/batch 1, cheapest config). Added `persist:false` so the proof has zero Supabase dependency. |

### Cascade correctness (item 3)
The cascade gate is unchanged and correct: it fires only on `transient && fallbacks.length>0`,
and the only throws reaching it from the HF image lane are real submit/poll/timeout/NSFW errors
from `submitAndPoll`. With the provider hardening, a post-success persist failure can no longer
throw out of the provider, so it can never be misread as a generation failure → no bogus cascade.

### Verify
| Check | Result |
|---|---|
| `scripts/test-capability-engine.ts` | **ALL PASS** (7 cases; [B] cascade path now also emits the new primary-error log line). |
| `scripts/test-higgsfield-provider.ts` | **ALL PASS** (green). |
| `scripts/test-brand-dna.ts` | **ALL PASS** (green). |
| `npx tsc --noEmit` | **0 errors** in any changed file. The 79 total errors remain 100% confined to the untouched `tests/e2e-production-test.spec.ts` (pre-existing). |
| `npm run build` | **exit 0** — "Compiled successfully". |

### Live proof (the ONE cost-gated generation)
| Item | Result |
|---|---|
| Run | `npx tsx scripts/run-capability-engine-live.ts` — **succeeded on the FIRST attempt, no retry.** |
| Served by | **higgsfield** (`meta.engine='higgsfield'`, `model='nano_banana_pro'`). No cascade — FAL never touched. |
| Output | `docs/proofs/capability-engine-live.png` — valid PNG, 1536×1536 RGB, 791,036 bytes, a single red apple on white (matches the prompt). |
| Duration | ~35s. `meta.degraded=(none)`. |
| Credits | ~2 (engine ESTIMATE; `qualityTier:'standard'` × `image_gen` base 2). Exactly ONE real generation consumed, per the hard cost gate. |

### NOT fixed (Rio decision — explicitly out of scope)
- **FAL fallback leg is unproven/unusable.** `.env.local` `FAL_KEY` is empty → `fal-ai/flux` → 401.
  The cascade's fallback engine cannot serve until a flux-authorized `FAL_KEY` is provided. This is
  an account-config decision, not an engine fix. The HF primary leg is now live-proven end-to-end
  through `runCapability`; the FAL leg remains proven only structurally (mock test [B]).
