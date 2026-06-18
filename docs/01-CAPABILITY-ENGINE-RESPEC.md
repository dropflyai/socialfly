# 01 — CAPABILITY-AWARE CONTENT ENGINE (Re-Spec)

**Date:** 2026-06-16 · **Brain:** ARCHITECTURE (x1000) · **Status:** DESIGN ONLY — no code changes in this doc; the build follows it.
**Scope:** Evolve SocialFly's per-provider router into a **capability-aware engine**: the orchestrator selects `engine × model × tool` by *(capability needed × quality tier × cost × availability × brand-DNA binding)*.

**Locked decisions (Rio, 2026-06-16) — inputs to this spec, not up for debate here:**
- **Higgsfield = PRIMARY / default engine** (full media surface).
- **FAL = kept** as a thin **reliability FALLBACK** + **commodity-draft** lane. Do NOT delete.
- **PRUNE** redundant standalone media lanes that Higgsfield now covers (Replicate/Stability/DALL-E/Nano-Banana — verified below).
- **Claude / OpenAI = TEXT / reasoning engines** (separate role; never media routing).

**Prime directive (U0 discipline):** every change is **additive and gated**. With Higgsfield key absent and defaults unset, selection must stay **byte-identical** to today. Prune = behind a **kill-switch**, never a hard delete until the capability layer demonstrably covers the lane.

---

## 1. CURRENT STATE (verified from code)

### 1.1 The seam that exists today
There is ONE consistent seam, repeated per modality (VERIFIED in `image-router.ts`, `video-router.ts`, `audio-router.ts`):

```
capability-matrix (static per-provider caps)
  → scoreProviders(request)      // keyword + flag heuristics → numeric score
  → pickProvider(request)        // explicit pref → config default → top score
  → generateWithX(...)           // per-provider adapter, normalized output shape
```

Entry points that funnel through this seam: `pipeline.generateAndPublish` → `generateImage`/`smartGenerateVideo`; `orchestra.orchestrateContent` → `smartGenerateImage`/`smartGenerateVideo`/`smartGenerateAudio`; `api/image/edit` → `smartEditImage`. Autopilot rides `generateAndPublish`. **Two surfaces BYPASS the seam:** `pipeline.generateImage()` calls FAL directly (not the router), and `/api/cron/automations` has its own inline FAL+Kling+ElevenLabs generation (architecture-rd §1.4). Both must be re-pointed during migration.

### 1.2 Lanes wired today (VERIFIED)

| Modality | Lane | How wired | Status vs Higgsfield |
|---|---|---|---|
| Image | **higgsfield** | `providers/higgsfield.ts` → `higgsfieldGenerateImage` (U0, gated on key) | **PRIMARY** — keep, expand |
| Image | **fal** (flux/schnell) | `generateWithFal` | **KEEP** — fallback + commodity draft |
| Image | **nanobanana** (gemini-2.5-flash-image) | `generateWithNanoBanana` / `editWithNanoBanana` | **PRUNE** — Higgsfield runs nano_banana_pro natively (it is HF's own default model) |
| Image | **dalle** (dall-e-3) | `generateWithDalle` | **PRUNE** — superseded by HF gpt_image/seedream; OpenAI stays TEXT-only |
| Image | **stability** (sd3.5-large) | `generateWithStability` | **PRUNE** — superseded by HF seedream/recraft |
| Video | **seedance / kling / minimax / ltx** | all via FAL (`video-router.ts`) | **KEEP (as FAL fallback subset)** — HF seedance_2_0/veo3 become primary; FAL Seedance/Kling/LTX stay as fallback + cheap-draft |
| Audio | **elevenlabs** | `audio-router.ts` | **KEEP for now** — HF has TTS (inworld ~120 voices) + music + SFX; ElevenLabs migration is a *later* optional rung, not part of the prune |
| Post-proc | **replicate** (rembg, real-esrgan, instruct-pix2pix, faceswap) | `replicate-tools.ts`, used by `orchestra.maybeEnhanceImage` | **PRUNE** — HF natively does `remove_background`, `upscale_image/video`, `reframe`, `outpaint`; faceswap → Soul identity |
| Text | **anthropic (claude) / openai (gpt-4o)** | `ai/claude.ts`, `ai/openai.ts` | **KEEP — separate TEXT role**, never media |

### 1.3 The concrete PRUNE list (verified blast radius)

**Prune-eligible because Higgsfield natively covers the capability:**

1. **`replicate-tools.ts`** — `removeBackground`, `upscaleImage`, `styleTransfer`, `faceSwap`, `generateWithCustomModel`.
   - Consumers (VERIFIED): `src/app/api/tools/replicate/route.ts`, `src/lib/engine/index.ts` (re-exports), `src/lib/engine/orchestra.ts` (`maybeEnhanceImage` uses `upscaleImage` + `removeBackground`).
   - HF replacements: `upscale_image`/`upscale_video`, `remove_background`, `reframe`/`outpaint`. `faceSwap` → obsoleted by **Soul** identity (the correct primitive). `styleTransfer` → flux_2 kontext.
2. **`generateWithStability`** (image-router.ts) + `stabilityApiKey`/`STABILITY_API_KEY`.
   - Consumers (VERIFIED): only `image-router.ts` itself + config/types plumbing. **Zero external callers.** Safe to gate off behind kill-switch immediately.
3. **`generateWithDalle`** (image-router.ts).
   - Consumers (VERIFIED): only `image-router.ts`. **Zero external callers.** (OpenAI key STAYS for text.)
4. **`generateWithNanoBanana` / `editWithNanoBanana`** (image-router.ts).
   - Consumers: `image-router.ts`; `smartEditImage` currently tries Nano Banana FIRST then falls to FAL. After prune, edit routes through HF flux_2 kontext (primary) → FAL (fallback). **Gemini key may stay for non-media uses if any; otherwise drop.**

**KEEP (locked):** `fal` (image flux + video seedance/kling/ltx), `elevenlabs` (until a later audio rung), `anthropic`+`openai` (text).

**Prune discipline:** each prune is a **kill-switch flag** (`ENGINE_PRUNE_LEGACY_MEDIA=true`), not a `git rm`, until the capability layer + Higgsfield live-key smoke proves coverage. The dead adapters stay compilable behind the flag for one release as an emergency rollback, then physically removed.

### 1.4 What's redundant vs not — the honest line
Higgsfield's catalog (CEO_BRIEF) makes redundant: **standalone image gen (Stability/DALL-E/Nano-Banana)** and **all Replicate post-processing**. NOT redundant: **FAL** (HF's own fallback + the only sub-second commodity-draft lane, and the supplier kill-switch), **ElevenLabs** (mature, deterministic; HF TTS migration is opt-in later), **Claude/OpenAI text**. This keeps exactly ONE primary engine + ONE reliability fallback per media modality, plus a separate text tier.

---

## 2. THE CAPABILITY MODEL

The pivot: the orchestrator stops asking *"which provider?"* and starts asking *"which capability do I need?"*. A **Capability** is a verb-noun the engine can perform, independent of which engine fulfills it. The provider routers become implementation detail under each capability.

### 2.1 Capability taxonomy (enum)

```ts
// types.ts — new
export type Capability =
  // --- core generation ---
  | 'image_gen'                 // text→image, generic
  | 'video_gen'                 // text→video / image→video, generic
  | 'audio_tts'                 // text→speech
  | 'audio_music'               // text→music bed
  | 'audio_sfx'                 // text→sound effect
  // --- brand-DNA-bound (Higgsfield-ONLY; no fallback by definition) ---
  | 'persona_consistent_image'  // Soul / soul_cast: same face/persona via soul_id
  | 'persona_consistent_video'  // seedance_2_0 / soul-driven identity in motion
  | 'brand_kit_image'           // ms_image "DTC Ads": logo/colors/fonts/avatars/products
  | 'ad_reference_video'        // marketing_studio_video ad_reference_id: clone a viral ad's structure
  | 'marketing_studio_video'    // hook_id + setting_id one-click UGC product ad
  // --- templated / preset ---
  | 'preset_i2v'                // higgsfield_preset: viral image→video templates
  // --- post-processing (image/video transforms) ---
  | 'reframe'                   // aspect-ratio re-crop (9:16 ↔ 1:1 ↔ 16:9), content-aware
  | 'outpaint'                  // extend canvas
  | 'upscale'                   // 2x/4x super-res (image OR video)
  | 'remove_bg'                 // transparent cutout
  // --- intelligence / analysis ---
  | 'video_analysis'           // scene-by-scene deconstruction (accepts YT URLs)
  | 'virality_predict'         // pre-publish oracle: hook strength / retention risk score
  // --- 3D ---
  | 'image_to_3d'              // mesh + PBR + rigging
  // --- text (separate tier; routed to Claude/OpenAI, NOT media engines) ---
  | 'text_gen'
```

`brand_kit_image`, `persona_consistent_*`, `ad_reference_video`, `marketing_studio_video`, `virality_predict`, `video_analysis` are **Higgsfield-ONLY** today — there is **no FAL/OSS fallback** that can produce them. This is a load-bearing operational fact (see §3 and §7).

### 2.2 Input / output contracts (the capability interface)

Every capability is invoked through ONE generic surface so the orchestrator never special-cases an engine:

```ts
interface CapabilityRequest<C extends Capability> {
  capability: C
  prompt?: string                  // text/gen capabilities
  inputs?: {                       // media inputs by role
    imageUrl?: string
    videoUrl?: string              // analysis / reframe / upscale-video
    referenceImages?: string[]
    referenceVideoUrl?: string     // ad_reference
    audioUrl?: string
  }
  brandDNA?: {                     // resolved server-side from loadBrandDNA — never raw client input
    soulId?: string
    brandKitStyleId?: string
    imageStyle?: string
  }
  format?: { aspectRatio?: '1:1'|'4:5'|'9:16'|'16:9'; durationSec?: number; platform?: Platform }
  qualityTier?: 'draft' | 'standard' | 'premium'
  budget?: { creditCeiling?: number; preferCheap?: boolean }
  preferredEngine?: EngineId       // escape hatch (e.g. force 'fal')
}
```

**Per-capability contract (input must-haves → output):**

| Capability | Required inputs | Output shape | Notes |
|---|---|---|---|
| `image_gen` | prompt | `GeneratedImage{url,prompt}` | unchanged shape |
| `video_gen` | prompt (+optional imageUrl for i2v) | `GeneratedVideo{url,provider,model,durationSeconds}` | unchanged shape |
| `persona_consistent_image` | prompt + `brandDNA.soulId` | `GeneratedImage` + `meta.soulId` | **fails-soft** to `image_gen`+text-context if soulId absent |
| `persona_consistent_video` | prompt/imageUrl + `brandDNA.soulId` | `GeneratedVideo` + `meta.soulId` | HF seedance_2_0 reference-driven |
| `brand_kit_image` | prompt + `brandDNA.brandKitStyleId` | `GeneratedImage` + `meta.brandKitStyleId` | requires `style_id` from HF marketing-studio |
| `ad_reference_video` | `inputs.referenceVideoUrl` (or `ad_reference_id`) + prompt | `GeneratedVideo` | HF-only; needs MCP-vs-REST confirm |
| `marketing_studio_video` | prompt + `hook_id`/`setting_id` | `GeneratedVideo` | HF-only |
| `preset_i2v` | `inputs.imageUrl` + `preset_id` | `GeneratedVideo` | HF higgsfield_preset |
| `reframe` | `inputs.imageUrl|videoUrl` + target aspect | `{url}` | HF native; replaces manual crop |
| `outpaint` | `inputs.imageUrl` + direction/ratio | `GeneratedImage` | HF native |
| `upscale` | `inputs.imageUrl|videoUrl` + scale | `{url}` | HF upscale_image/video (replaces real-esrgan) |
| `remove_bg` | `inputs.imageUrl` | `{url}` transparent png | HF remove_background (replaces rembg) |
| `video_analysis` | `inputs.videoUrl` (YT ok) | `{scenes[],hooks[],retentionCurve}` | feeds trend engine (U6) |
| `virality_predict` | `inputs.videoUrl` | `{score, hookStrength, retentionRisk}` | pre-publish gate (U4) |
| `image_to_3d` | `inputs.imageUrl[]` | `{meshUrl, textures}` | low priority for social |
| `audio_tts` | prompt + voiceId/style | `GeneratedAudio` | ElevenLabs primary today; HF inworld later |
| `audio_music`/`audio_sfx` | prompt | `{url}` | HF sonilo/mirelo (new capability, no current lane) |
| `text_gen` | prompt + brand context | text/variants | Claude primary, OpenAI fallback |

**Output normalization rule:** every capability returns the existing normalized shapes (`GeneratedImage`/`GeneratedVideo`/`GeneratedAudio`) plus an optional `meta` (`engine`, `model`, `tool`, `creditsSpent`, `soulId?`, `brandKitStyleId?`, `routingScore?`). This keeps `pipeline`/`orchestra` consumers unchanged.

---

## 3. ENGINE REGISTRY + CAPABILITY MATRIX

### 3.1 Engines (providers re-cast as engines)

```ts
export type EngineId = 'higgsfield' | 'fal' | 'elevenlabs' | 'anthropic' | 'openai'

interface EngineDescriptor {
  id: EngineId
  role: 'media-primary' | 'media-fallback' | 'audio' | 'text-primary' | 'text-fallback'
  supports: Set<Capability>            // which capabilities this engine can fulfill
  models: Record<Capability, string>   // capability → concrete model id (HF zoo)
  availabilityRisk: 'low' | 'medium' | 'high'
  healthKey: string                    // for the live availability check / circuit breaker
}
```

- **higgsfield** — `media-primary`. Full surface. Models: `image_gen`→`nano_banana_pro`/`seedream_v4_5`; `persona_consistent_image`→`soul_2`/`soul_cast`; `brand_kit_image`→`ms_image`; `video_gen`→`seedance_2_0`/`veo3`; `persona_consistent_video`→`seedance_2_0`; `ad_reference_video`/`marketing_studio_video`→`marketing_studio_video`; `preset_i2v`→`higgsfield_preset`; `reframe`/`outpaint`/`upscale`/`remove_bg`→native tools; `video_analysis`/`virality_predict`→native; `image_to_3d`→`image_to_3d`; `audio_tts`→`inworld_text_to_speech`; `audio_music`→`sonilo_music`; `audio_sfx`→`mirelo_text_to_audio`. **availabilityRisk: high** (single supplier, reputation, REST-surface unknown for soul/ms/virality).
- **fal** — `media-fallback`. Supports: `image_gen` (flux), `video_gen` (seedance/kling/minimax/ltx), and serves the **commodity-draft** lane for both. availabilityRisk: low.
- **elevenlabs** — `audio`. Supports: `audio_tts` (primary today). availabilityRisk: low.
- **anthropic** — `text-primary`. `text_gen`. availabilityRisk: low.
- **openai** — `text-fallback`. `text_gen`. availabilityRisk: low. (DALL-E media path PRUNED.)

### 3.2 Capability × Engine matrix

Legend — Support: ✅ full · ⚠️ partial/draft-only · ❌ none. Cost: relative ($=cheap…$$$$=premium). Quality tier reachable. Avail-risk inherited from engine.

| Capability | higgsfield | fal | 11labs | claude/oai | Fallback exists? |
|---|---|---|---|---|---|
| `image_gen` | ✅ $$ premium (`nano_banana_pro`/`seedream`) | ✅ $ draft (`flux/schnell`) | — | — | **YES → fal** |
| `video_gen` | ✅ $$$ premium (`seedance_2_0`/`veo3`) | ✅ $–$$ (`ltx` draft / `kling` mid / `seedance` ~$0.80) | — | — | **YES → fal** |
| `persona_consistent_image` | ✅ $$$ (`soul_2`/`soul_cast`) | ❌ | — | — | **NO — HF-ONLY** |
| `persona_consistent_video` | ✅ $$$$ (`seedance_2_0` ref-driven) | ⚠️ (no soul; only generic i2v look-alike) | — | — | **NO (degraded only)** |
| `brand_kit_image` | ✅ $$$ (`ms_image` DTC) | ❌ | — | — | **NO — HF-ONLY** |
| `ad_reference_video` | ✅ $$$$ (`ad_reference_id`) | ❌ | — | — | **NO — HF-ONLY** |
| `marketing_studio_video` | ✅ $$$$ (`hook_id`+`setting_id`) | ❌ | — | — | **NO — HF-ONLY** |
| `preset_i2v` | ✅ $$$ (`higgsfield_preset`) | ⚠️ (plain i2v, no template) | — | — | partial |
| `reframe` | ✅ $ | ❌ | — | — | NO (was manual) |
| `outpaint` | ✅ $$ | ❌ | — | — | NO |
| `upscale` | ✅ $ (img+video) | ❌ | — | — | NO (replaces real-esrgan) |
| `remove_bg` | ✅ $ | ❌ | — | — | NO (replaces rembg) |
| `video_analysis` | ✅ $$ | ❌ | — | — | **NO — HF-ONLY** |
| `virality_predict` | ✅ $$ | ❌ | — | — | **NO — HF-ONLY** |
| `image_to_3d` | ✅ $$$ | ❌ | — | — | NO |
| `audio_tts` | ⚠️ (`inworld`, later) | ❌ | ✅ $$ primary | — | **YES → 11labs** |
| `audio_music` | ✅ $$ (`sonilo`) | ❌ | ❌ | — | NO (new capability) |
| `audio_sfx` | ✅ $ (`mirelo`) | ❌ | ❌ | — | NO (new capability) |
| `text_gen` | ❌ | ❌ | — | ✅ claude primary / oai fallback | YES |

### 3.3 The Higgsfield-ONLY set (flag the operational implication)

**No-fallback capabilities:** `persona_consistent_image`, `persona_consistent_video` (true fallback = degraded), `brand_kit_image`, `ad_reference_video`, `marketing_studio_video`, `video_analysis`, `virality_predict`. (Plus `reframe`/`outpaint`/`upscale`/`remove_bg`/`image_to_3d`/`audio_music`/`audio_sfx` which simply had no prior lane.)

**Implication:** these are exactly the **moat capabilities** (Soul identity, brand-kit, virality gate) AND they have **zero reliability fallback**. When Higgsfield is down/timed-out for one of these, the cascade in §4 **cannot route around it** — it must **fail-soft or queue**, never silently degrade brand identity into a generic look-alike without flagging it. This is the single biggest availability concern in the system and the reason the `generation_jobs` queue + circuit breaker (§4.4) are mandatory, not optional.

---

## 4. THE SELECTION POLICY (pivotal)

The orchestrator resolves a `CapabilityRequest` to a concrete `(engine, model, tool)` plan, then executes with a fallback cascade. This REPLACES the per-modality `pickProvider` keyword heuristics with a single capability-first resolver. The existing `scoreProviders` heuristics are demoted to a **tie-breaker within the fallback engine** (FAL still picks flux vs seedance vs kling for draft work).

### 4.1 Inputs
`capability`, `qualityTier (draft|standard|premium)`, `budget.creditCeiling` + `preferCheap`, `brandDNA (soulId/brandKitStyleId presence)`, `format (platform/aspect/duration)`, `availability (live engine health)`, `preferredEngine (escape hatch)`.

### 4.2 Resolution algorithm (pseudocode)

```
function resolvePlan(req): Plan | FailSoft {
  // 0. capability → candidate engines that SUPPORT it, ordered by role precedence
  //    (media-primary > media-fallback; audio; text)
  candidates = ENGINE_REGISTRY.filter(e => e.supports.has(req.capability))

  // 1. HARD CONSTRAINTS first (these can eliminate the primary)
  // 1a. brand-DNA binding: if capability is persona/brand-kit, soulId/brandKitStyleId MUST be present
  if (isBrandDnaBound(req.capability) && !hasRequiredDNA(req)) {
      return degradeOrFail(req)   // → see 4.3 fail-soft ladder (do NOT silently fake identity)
  }
  // 1b. explicit escape hatch
  if (req.preferredEngine) candidates = candidates.filter(e => e.id === req.preferredEngine)

  // 2. AVAILABILITY filter (circuit breaker): drop engines whose breaker is OPEN
  live = candidates.filter(e => circuitBreaker.isClosed(e.healthKey))
  if (live.isEmpty) return queueOrFailSoft(req)   // 4.4

  // 3. QUALITY-TIER + BUDGET selection among live engines
  //    draft  → cheapest engine that supports it (FAL flux/ltx) UNLESS DNA-bound (then HF only)
  //    standard/premium → Higgsfield primary model for the capability
  if (req.qualityTier === 'draft' && !isBrandDnaBound(req.capability) && fal.supports(req.capability))
      engine = fal
  else
      engine = highestPrecedenceLive(live)   // Higgsfield wins for standard/premium

  // 4. BUDGET CEILING: estimate credits; if over ceiling, step DOWN a tier or switch to draft engine
  est = estimateCredits(engine, req.capability, req.qualityTier, req.format)
  if (req.budget.creditCeiling && est > req.budget.creditCeiling) {
      if (canDowngrade(req)) return resolvePlan({...req, qualityTier: downgrade(req.qualityTier)})
      else return failSoft(req, 'OVER_BUDGET')
  }

  // 5. bind concrete model + tool
  return { engine, model: engine.models[req.capability], tool: toolFor(req.capability), estCredits: est }
}
```

### 4.3 Precedence & the fail-soft ladder

**Precedence (no explicit pref, standard/premium tier):** `higgsfield (primary)` → `fal (fallback)`. For `draft` tier on fallback-eligible capabilities, FAL is selected *first* by cost (the predict-cheap lane).

**Fail-soft ladder for brand-DNA-bound capabilities (NO real fallback):**
1. Required DNA present + HF up → generate premium (normal path).
2. Required DNA present + HF breaker OPEN → **enqueue** in `generation_jobs` (status `queued_engine_down`), return a "pending, will post when engine recovers" result. Autopilot treats as deferred, not failed.
3. Required DNA **absent** (e.g. free tier, no soul trained) → **degrade WITH a flag**: route to `image_gen`/`video_gen` + `buildVisualBrandContext` text injection, and set `meta.degraded='no_soul'` so the UI/autopilot knows identity is NOT locked. Never pretend it's persona-consistent.
4. HF down AND it's a pure-intelligence capability (`virality_predict`/`video_analysis`) → **skip the gate, do not block publish**, log `meta.gateSkipped=true`. (A missing oracle must never stall the pipeline.)

### 4.4 The fallback cascade (execution-time, on error/timeout)

```
async function executeWithCascade(plan, req):
  try:
    return await run(plan.engine, plan.model, req)      // 1. primary attempt
  catch (err):
    circuitBreaker.record(plan.engine.healthKey, err)   // count toward breaker trip

    isTransient = err in {TIMEOUT, 5xx, RATE_LIMIT, HF_SUBMIT_FAILED, HF_POLL_FAILED}
    if (isHiggsfieldOnly(req.capability)):
      // NO engine fallback possible → queue (DNA-bound) or skip (intelligence)
      return failSoftPerLadder(req, err)                // 4.3 steps 2/4
    if (isTransient and fal.supports(req.capability)):
      log('cascade: higgsfield → fal', err)
      return await run(fal, fal.models[req.capability], req)   // 2. FAL fallback
    if (err is HF_TIMEOUT and jobId):
      persist generation_jobs row(jobId, status='polling')     // poll-cron resumes it
      return pendingResult(jobId)
    throw err                                            // 3. non-recoverable
```

**Circuit breaker:** per-engine. N consecutive transient failures (e.g. 5 in 2 min) → breaker OPEN for cooldown (e.g. 5 min) → `resolvePlan` skips Higgsfield and routes fallback-eligible work straight to FAL, while DNA-bound work queues. Half-open probe re-closes on first success. This prevents every request paying the full HF timeout when HF is down.

### 4.5 Predict-cheap → generate-premium path (the credit-saver + virality gate)

For video (and optionally image) autopilot content, the policy runs a **two-phase** flow when `qualityTier != 'draft'` and budget allows:

```
PHASE A (cheap):  resolvePlan(capability=video_gen, qualityTier='draft')  // FAL ltx, ~$0.02
                  → generate K cheap variants (different hook/opener/preset)
PHASE B (gate):   for each draft → virality_predict (HF)                  // pre-publish oracle
                  pick argmax(score) above THRESHOLD
                  if none clears threshold → regenerate Phase A with new candidates (bounded retries)
PHASE C (premium): resolvePlan(capability=persona_consistent_video|video_gen, qualityTier='premium')
                  → generate the WINNER once on Higgsfield (seedance_2_0 + soulId)
```

This spends premium HF credits on exactly one winner instead of K, directly addressing the ~$60–136/mo/account unit-economics risk (00-RD §2). If `virality_predict` is unavailable (HF down / not on REST surface), Phase B is skipped and Phase C generates the top-ranked draft's concept directly (gate-skipped, logged).

### 4.6 Decision table (worked examples)

| capability | tier | soulId? | budget | HF health | → engine.model | path |
|---|---|---|---|---|---|---|
| `image_gen` | premium | – | ok | up | higgsfield.`nano_banana_pro` | primary |
| `image_gen` | draft | – | preferCheap | up | **fal.flux/schnell** | cheap lane (HF not used) |
| `image_gen` | premium | – | ok | **DOWN** | fal.flux/schnell | cascade fallback |
| `persona_consistent_image` | premium | ✅ | ok | up | higgsfield.`soul_2` | primary (moat) |
| `persona_consistent_image` | premium | ✅ | ok | **DOWN** | — | **queue** (no fallback) |
| `persona_consistent_image` | premium | ❌ | ok | up | higgsfield.`image_gen`+text-ctx | **degrade, flag `no_soul`** |
| `brand_kit_image` | premium | brandKit✅ | ok | up | higgsfield.`ms_image` | primary (HF-only) |
| `video_gen` | premium | – | overCeiling | up | step down → fal.kling/ltx | budget downgrade |
| `marketing_studio_video` | premium | – | ok | **DOWN** | — | **queue** (HF-only) |
| `virality_predict` | – | – | ok | **DOWN** | — | **skip gate**, publish anyway |
| `upscale`/`remove_bg` | – | – | ok | up | higgsfield native tool | replaces Replicate |
| `audio_tts` | standard | – | ok | (11labs up) | elevenlabs | unchanged primary |
| `text_gen` | – | – | ok | claude up | anthropic | (oai fallback) |

---

## 5. MIGRATION PLAN (evolve, don't rip-and-replace)

The existing seam (`capability-matrix → scoreProviders → pickProvider → generateWithX`) is **preserved underneath**. We add a thin **Capability layer ABOVE** the provider routers. No consumer of `smartGenerateImage`/`smartGenerateVideo`/`smartGenerateAudio` changes signature — those become thin wrappers that call the new resolver with `capability:'image_gen'|'video_gen'|'audio_tts'`.

### 5.1 New module: `engine/capability-engine.ts`
- `ENGINE_REGISTRY` (§3.1), `CAPABILITY_MATRIX`, `resolvePlan()` (§4.2), `executeWithCascade()` (§4.4), `circuitBreaker`, `estimateCredits()`.
- `runCapability(req: CapabilityRequest): Promise<CapabilityResult>` — the ONE public entry the orchestrator calls.
- Internally dispatches to: existing `higgsfieldGenerate*` (expanded), existing FAL `generateWithFal`/`generateVideoWithProvider`, existing `smartGenerateAudio`. **Reuses the adapters; adds no new HTTP code except expanding `providers/higgsfield.ts`.**

### 5.2 `providers/higgsfield.ts` expansion (same U0 discipline)
Add, behind the SAME `submitAndPoll` + tagged-constant pattern: `higgsfieldGenerateVideo` (U1), and capability adapters `higgsfieldPersonaImage(soulId)`, `higgsfieldBrandKitImage(styleId)`, `higgsfieldReframe/Outpaint/Upscale/RemoveBg`, `higgsfieldViralityPredict`, `higgsfieldVideoAnalysis`. Every uncertain REST detail stays in the `// UNCONFIRMED until prod key minted` constants — one-file confirm, no redesign. Each new capability ships only after its REST-vs-MCP surface is confirmed (§7).

### 5.3 Wiring changes (minimal)
- `image-router.ts` / `video-router.ts`: keep `scoreProviders`/`pickProvider` but they now operate **within the FAL fallback engine only** (selecting flux vs draft model). `smartGenerateImage` → calls `runCapability({capability:'image_gen', ...})`.
- `pipeline.generateImage()`: re-point off direct-FAL onto `runCapability` (closes the bypass noted in §1.1).
- `/api/cron/automations` inline generation: re-point onto `runCapability` (closes the second bypass) — this is rung U3b.
- `orchestra.maybeEnhanceImage`: swap `upscaleImage`/`removeBackground` (Replicate) → `runCapability({capability:'upscale'|'remove_bg'})` (Higgsfield). Behind the prune kill-switch; Replicate stays as the flag-OFF path for one release.

### 5.4 Interface changes (types.ts / config.ts)
**types.ts:** add `Capability`, `EngineId`, `CapabilityRequest`, `CapabilityResult` (+ `meta`), `EngineDescriptor`. Extend `GeneratedImage`/`GeneratedVideo` with optional `meta`. Add `qualityTier` + `creditCeiling` to `OrchestraRequest` (additive, optional).
**config.ts:** add flags —
- `ENGINE_DEFAULT_MEDIA_ENGINE` (default `'auto'`; set to `'higgsfield'` to make HF primary explicitly).
- `ENGINE_PRUNE_LEGACY_MEDIA` (default `false`; `true` removes Stability/DALL-E/Nano-Banana/Replicate lanes from selection).
- `ENGINE_CIRCUIT_BREAKER` tuning (threshold, cooldown).
- Existing `higgsfield*` config unchanged.

### 5.5 Zero-behavior-change discipline (the gate)
With `HIGGSFIELD_API_KEY` absent **and** `ENGINE_DEFAULT_MEDIA_ENGINE` unset **and** `ENGINE_PRUNE_LEGACY_MEDIA=false`, `runCapability` must resolve **identically** to today's `pickProvider` output. Same contract test as U0 (assert byte-identical selection with key absent). Prune flips ON only after Higgsfield live-key smoke proves each capability.

### 5.6 Safe prune sequence
1. Land capability layer with all legacy lanes still selectable (flag OFF) — no behavior change.
2. Confirm HF live contract for `image_gen`, `upscale`, `remove_bg` (the cheap, low-risk capabilities).
3. Flip `ENGINE_PRUNE_LEGACY_MEDIA=true` in staging → run the orchestra E2E → confirm HF covers post-processing.
4. After one stable release, physically delete `replicate-tools.ts`, `generateWithStability/Dalle/NanoBanana`, drop `stabilityApiKey`/`replicateApiToken` from config/types, remove `api/tools/replicate/route.ts`, prune `index.ts` re-exports.

---

## 6. REVISED BUILD LADDER (capability-aware; each rung has an E2E gate)

- **U0 ✅ DONE** — `HiggsfieldProvider` behind image-router (image only, gated, zero-behavior-change). *(already shipped — see U0-build-log.)*
- **U1 — Capability layer + video parity.** Introduce `capability-engine.ts` (`runCapability`, registry, matrix, resolver, cascade, circuit breaker) as a thin layer over existing routers; `image_gen`/`video_gen` route through it. Add `higgsfieldGenerateVideo` (seedance_2_0/veo3, submit→poll, serverless-safe). **E2E gate:** one real video via HF within 300s; forced-failure falls back to FAL; key-absent selection byte-identical to U0.
- **U2 — Brand-DNA persistence + binding (IMMEDIATE NEXT, moat).** Migration `020`: `brand_souls`, `soul_memory`, `generation_jobs`. `loadBrandDNA(userId,brandId)` (joins profiles+kits+souls). Add capabilities `persona_consistent_image`, `brand_kit_image` to the matrix. Wire `loadBrandVoice→loadBrandDNA` at the TWO entry points (`pipeline`, `orchestra`); forward `soulId`/`brandKitStyleId` into `runCapability`. **Interlock:** the capability engine's brand-DNA-bound branch (§4.3) is *exactly* what consumes U2's `soulId`/`brandKitStyleId` — U2 supplies the DNA, the engine binds it. **E2E gate:** brand with `hf_soul_id` → `generateAndPublish` produces same-face on-brand media + writes a `soul_memory` row; brand WITHOUT a soul degrades-with-flag (`no_soul`) and still posts.
- **U3 — Autopilot uses Higgsfield primary.** Set `ENGINE_DEFAULT_MEDIA_ENGINE='higgsfield'`. **U3b:** migrate `/api/cron/automations` inline generation onto `runCapability`. **E2E gate:** autopilot dry-run draft uses HF + brand soul; `generation_jobs`+`soul_memory` logged; forced-failure run falls back to FAL and still produces a draft.
- **U4 — Virality GATE (predict-cheap → generate-premium).** Add `virality_predict` capability + the §4.5 two-phase flow into the autopilot path. **E2E gate:** weak draft scores low → system regenerates → the second clears threshold and is the one published; score persisted; HF-down skips gate and still publishes.
- **U5 — Performance-memory routing (the moat closes).** `soul_memory` feedback biases `resolvePlan` (winning hook/format/preset for THIS audience boosts those candidate plans). **E2E gate:** after N posts, the resolver demonstrably shifts candidate selection toward historically-winning formats.
- **U6 — Marketing-studio / ad_reference + prune flip + trend ingestion.** Add `marketing_studio_video`, `ad_reference_video`, `video_analysis` capabilities (HF-only) — only after REST-vs-MCP confirmed (else MCP-worker path). Flip `ENGINE_PRUNE_LEGACY_MEDIA=true`; begin exogenous trend ingestion (Creative Center/YouTube/Ad Library) + bandit variant testing into Phase A candidates. **E2E gate:** one-click DTC ad + "recreate this viral ad" produce on-brand video; orchestra post-proc runs on HF tools; legacy lanes removed without regression.
- **U7 — AI Mentor surface + 3D/music/SFX capabilities.** Narrate engine/soul_memory state → one-tap actions; add `audio_music`/`audio_sfx`/`image_to_3d`/`reframe`/`outpaint` capabilities to the user-facing toolset. **E2E gate:** weekly digest renders real soul_memory insights, each ending in a one-tap capability action.

---

## 7. RISKS

1. **REST-vs-MCP surface unknown for the moat capabilities.** `soul_id`, `marketing_studio`/`brand_kit`, `ad_reference`, `virality_predict`, `video_analysis` may be **MCP-only**, not on the Cloud REST surface. ⚠️ TOP BLOCKER (Rio minting key to confirm). Mitigation: every such capability is gated; if MCP-only, an **operator/worker service** holds the HF session for those specific capabilities while plain REST (nano_banana/seedream/seedance/veo3) ships now. The capability layer makes this a per-capability routing decision, not a redesign.
2. **No-fallback reality for HF-only capabilities (§3.3).** Soul/brand-kit/ad-reference/virality have **zero reliability fallback**. When HF is down, those requests **must queue or fail-soft**, never silently fake brand identity. Mandatory: `generation_jobs` queue + circuit breaker + the §4.3 fail-soft ladder. A degraded-identity post is a brand-safety incident, not a graceful fallback.
3. **Async / serverless timeout.** HF video can exceed Vercel limits. Mitigation (carried from U0): `submitAndPoll` budgets ~240s, persists `hf_job_id` on submit, `/api/cron/poll-jobs` (1-min) resumes orphaned jobs; webhook once verified. The circuit breaker prevents every request paying a full HF timeout when HF is down.
4. **Credit-cost control / unit economics.** ~$60–136/mo/account at retail; flat pricing is insolvent. Mitigation: the §4.5 predict-cheap→generate-premium path spends premium credits on ONE winner; `creditCeiling` per request with tier-downgrade; `hf_credits_spent` ledger in `generation_jobs` surfaced via `getSpendReport`; nightly `balance` check guards silent depletion; idempotency key (hash userId+prompt+model+minute-bucket, UNIQUE) so cron retries never double-spend.
5. **Prune regression risk.** Removing Replicate/Stability lanes before HF coverage is proven could silently break orchestra post-processing or edit flows. Mitigation: kill-switch (not delete) + staged flip + one stable release of flag-OFF rollback path before physical removal.
6. **Multi-tenant DNA leak.** `soulId`/`brandKitStyleId` are per-tenant; cross-tenant leak = one brand's face on another's posts. Mitigation: RLS on new tables; `loadBrandDNA` always `userId`-scoped; `runCapability` receives DNA only from a server-loaded DNA object, NEVER from raw request input.

---

## TOP 3 RECOMMENDATIONS
1. **Ship the capability layer as a thin, gated wrapper over the existing seam (U1) before any prune.** It is the structural unlock for everything (selection policy, virality gate, performance-memory routing) and it costs one new module + wrapper functions — not a rewrite. Keep key-absent selection byte-identical (same U0 contract test).
2. **Make the circuit breaker + `generation_jobs` queue + fail-soft ladder first-class from U1, not retrofitted.** The HF-only moat capabilities have NO fallback; without graceful queue/skip, a Higgsfield outage degrades brand identity or stalls autopilot. This is the highest-leverage reliability investment and it directly protects the moat.
3. **Wire the predict-cheap→generate-premium path (U4) tightly to U2's brand-DNA binding.** Drafting cheap on FAL, gating with HF `virality_predict`, then generating the single winner premium on HF+soulId is simultaneously the unit-economics fix AND the anti-slop quality gate AND the moat's feedback source. One flow, three strategic wins.

## OPEN QUESTIONS FOR RIO
1. **Mint the prod key and confirm the contract.** (a) Auth: single `Bearer` vs `key:secret`? (b) Which of `soul_id`, `marketing_studio/brand_kit`, `ad_reference`, `virality_predict`, `video_analysis` are on the Cloud REST surface vs MCP-only? If MCP-only — do we accept a separate operator/worker service for those (U6), or scope v1 to plain REST models?
2. **Audio posture:** keep ElevenLabs as `audio_tts` primary indefinitely, or migrate to HF `inworld` (consolidate to one vendor + unlock `audio_music`/`audio_sfx`) at U7? Affects whether ElevenLabs is "keep" or "later-prune."
3. **Soul provisioning UX:** how does a brand get its `soul_id` — train from uploaded photos at onboarding, or optional-until-upload? Decides whether U2 needs an onboarding training step and how often the `no_soul` degrade path fires in production.
4. **Prune aggressiveness:** flip `ENGINE_PRUNE_LEGACY_MEDIA` per-capability as each is HF-confirmed (incremental, safer), or all-at-once at U6 (cleaner, riskier)?
