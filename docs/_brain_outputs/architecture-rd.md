# ARCHITECTURE R&D — Higgsfield Engine Rework (no rip-and-replace)

**Brain:** Architecture · **Date:** 2026-06-16 · **Repo:** `~/dropfly_projects/socialfly`
**Scope:** Make Higgsfield the *primary* content engine by slotting a `HiggsfieldProvider` behind the EXISTING router seams, keeping current providers as fallback. Plus the per-account "Soul ledger" data model, an incremental build ladder with E2E gates, and risks.

> VERIFIED = read in this session from the code/MCP. ASSUMED = needs Rio/live confirmation. I flag every assumption.

---

## 1. CURRENT-STATE MAP (how content is generated today)

### 1.1 The layering (VERIFIED, read end-to-end)

```
API routes (src/app/api/*)  ── thin HTTP wrappers: auth + rate-limit + deductCredits, then call engine
        │
        ▼
engine/pipeline.ts  generateAndPublish()  ── topic → text → (image|video) → publish/schedule
engine/orchestra.ts orchestrateContent()  ── richer: text+image+video+audio, budget tiers, A/B, fallbacks, perf logging
engine/autopilot.ts runAutopilot()        ── cron brain: calendar → repurpose → smart gap-fill → insights
        │
        ▼  (the PROVIDER-ROUTING SEAM — our integration point)
engine/image-router.ts  smartGenerateImage()  → fal | nanobanana | dalle | stability
engine/video-router.ts  smartGenerateVideo()  → seedance | kling | minimax | ltx   (all via FAL)
engine/audio-router.ts  smartGenerateAudio()  → elevenlabs (single provider, voice catalog)
engine/generate.ts      generateContent()/generateImage() → Claude (text) + FAL flux/schnell (image)
        │
        ▼
engine/publish.ts → platforms/index.ts → instagram/facebook/linkedin/tiktok/twitter
```

`engine/config.ts` is the DI hub: `initEngine()` builds one `EngineConfig` from explicit args OR env vars, and `getConfig()/getSupabase()` are read everywhere. **Every provider reaches credentials through `getConfig()`** — so adding `higgsfieldApiKey` is a one-line change that flows everywhere.

### 1.2 The router abstraction (THE SEAM — VERIFIED)

Both image and video routers follow an identical, clean pattern:

1. A **capability matrix** (per-provider scores 0-10 for textInImage, cinematicQuality, etc.).
2. `scoreProviders(request)` → keyword/flag heuristics → ranked `ProviderScore[]`.
3. `pickProvider(request)` → honors `request.preferredProvider`, then `config.defaultImageProvider/defaultVideoProvider`, then the top score.
4. Per-provider async `generateWithX(prompt, ...)` functions, each returning a normalized `GeneratedImage`/`GeneratedVideo`.
5. `smartGenerateX()` = score → pick → dispatch → return result + routing trace.

**This is the integration point.** Higgsfield slots in as (a) a new provider entry in the capability matrix, (b) a `generateWithHiggsfield()` function, (c) a dispatch branch in `smartGenerateX`, and (d) a top-of-list entry in `config.default*Provider`. The orchestra and autopilot don't change — they call `smartGenerateImage/Video/Audio` and inherit Higgsfield automatically.

### 1.3 Providers wired today (VERIFIED via package.json + code)

| Modality | Providers | How |
|---|---|---|
| Text | Claude (`@anthropic-ai/sdk` claude-sonnet-4) primary; OpenAI GPT-4o fallback | direct SDK calls in `generate.ts`, `ai/claude.ts`, `ai/openai.ts` |
| Image | FAL flux/schnell (default), Nano Banana (`@google/genai` gemini-2.5-flash-image), DALL-E 3, Stability SD3.5 (raw REST) | `image-router.ts` |
| Video | Seedance/Kling/Minimax/LTX — **all hosted via FAL** (`fal.subscribe(modelId,...)`) | `video-router.ts` |
| Audio | ElevenLabs (`@elevenlabs/elevenlabs-js`), curated voice catalog | `audio-router.ts` |
| Post-proc | Replicate (`replicate`) — bg removal, upscale, style transfer, face swap | `replicate-tools.ts` |
| Video composite | Creatomate (render+poll) | `video-composer.ts` |

Note: **FAL is the dominant media backbone.** Nearly all video and the default image path go through FAL's `fal.subscribe()`, which itself does submit→poll internally and returns a final URL — a sync-looking call over an async backend. This is the EXACT shape Higgsfield's async job model needs, which is good news (Section 2).

### 1.4 How autopilot drives generation→publish (VERIFIED)

`runAutopilot(config)` (cron, hourly via `/api/cron/automations`; also a separate `automation_rules` engine inline in that route):
1. Guards: `enabled`, quiet hours, `maxPostsPerDay`.
2. `executeCalendarPosts` → `executeCalendarEntry` → `generateAndPublish`.
3. `repurposeTopPerformers` → reads analytics, finds high-engagement posts, calls `generateAndPublish` for other platforms.
4. `smartGapFill` → weighted product + content-pillar pick → `generateAndPublish`.
5. `generateInsights` + `logAutopilotRun`.

So **every autopilot content action funnels through `generateAndPublish` (pipeline.ts), which funnels through `generateImage`/`smartGenerateVideo`.** Swap those and autopilot is Higgsfield-powered with no autopilot edits. NOTE: `pipeline.generateImage()` currently calls FAL **directly** (not `smartGenerateImage`) — that's a small inconsistency we exploit in U0 (re-point it to the router).

The `/api/cron/automations` route has its OWN inline generation (FAL flux + Kling i2v + ElevenLabs + Creatomate) that bypasses the routers entirely (lines 537-650). This is a second integration surface that must be migrated to the router seam (rung U3b) or it will keep using FAL.

### 1.5 How brand.ts is used today (VERIFIED — and it's thin)

`brand.ts` is **42 lines, text-only**:
- `loadBrandVoice(userId, brandId?)` → reads `brand_profiles` (tone, description, vocabulary, audience, industry, hashtag_sets).
- `buildBrandContext(brand)` → flattens to a string injected into **Claude text prompts only**.

There is a **separate** `assets.ts` `BrandKit` (logos, colors, fonts, imageStyle) in table `brand_kits`, plus rich `brand_profiles` columns from migration 012 (color_accent, font_heading/body, image_style, target_pain_points, content_pillars, raw_analysis). **Critically: none of the visual brand data is injected into image/video generation today.** The image path gets a generic Claude-enhanced prompt; brand colors/logo/persona never reach the pixels. This is the gap the "Brand DNA / Soul" layer (Section 3) fills, and it's exactly what Higgsfield's soul_id / brand-kit-aware models are built for.

### 1.6 Credits & serverless config (VERIFIED)

- `CREDIT_COSTS` (plans.ts): caption 1, image_edit 3, image_generate 5, video_fast 25, video_quality 50. API routes call `deductCredits()` BEFORE generating.
- `vercel.json`: maxDuration 300s on `video/generate` and `cron/automations`; 60s on `image/generate` and `content/generate`. Crons: publish (1m), engagement (6h), automations (1h), growth (daily).
- No retry/idempotency keys on generation today; a duplicate cron tick can double-generate (autopilot guards by `maxPostsPerDay` and dedup-by-text, not by idempotency key).

---

## 2. THE HIGGSFIELD INTEGRATION DESIGN

### 2.1 The live contract (VERIFIED via docs + GitHub SDK — but FLAGGED)

I researched the actual surface so we don't design to a fantasy. Findings, separating verified from must-confirm:

**VERIFIED (public docs/SDK):**
- A **Cloud REST API exists at `https://api.higgsfield.ai`** with **Bearer auth** (`Authorization: Bearer <key>`). Endpoints documented: `POST /v1/generations` (text-to-image, image-to-video — task discriminator in body), `GET /v1/generations/{id}` (status: pending/processing/completed + output URL), `DELETE /v1/generations/{id}` (cancel). ([apidog](https://apidog.com/blog/higgsfield-api/))
- **Async = submit-then-poll**: POST returns `202` with an `id`; you GET until `completed`. **Optional `webhook_url`** is supported for completion callbacks. Errors: 400/401/422/429. ([apidog](https://apidog.com/blog/higgsfield-api/))
- An **official client exists** (`higgsfield-client` on GitHub) but it is **PYTHON ONLY** — `submit()/submit_async()` + `subscribe()` (blocks to completion) or `poll_request_status()` (yields Queued/InProgress/Completed/Failed/NSFW/Cancelled). Model IDs look like `'bytedance/seedream/v4/text-to-image'`. Results: `result['images'][0]['url']`. Auth via `HF_KEY="key:secret"` OR `HF_API_KEY`+`HF_API_SECRET`. ([GitHub](https://github.com/higgsfield-ai/higgsfield-client))
- Live credit model (from the in-session MCP): plans **Plus/Ultra**, one-time **credit packs (500/1k/2k/4k)**, and **auto-refill** — so consumption is credit-metered per generation, billed to the workspace that owns the key.

**MUST CONFIRM (Rio mints the key):** ⚠️ The docs and the SDK disagree in two ways that change the client code:
1. **Auth:** docs say single `Bearer <key>`; SDK says `key:secret` pair. The real dashboard key format decides whether we store one secret or two.
2. **Endpoint shape:** docs show a generic `/v1/generations` with a `task`/`model:"flux"`; the SDK uses **model-ID-routed** submits (`bytedance/seedream/...`, and presumably `higgsfield/soul/...`). The MCP we explored exposes the *rich* model zoo (soul_2 with `soul_id`, seedance_2_0, veo3, marketing_studio_*, virality_predictor). **Whether soul_id / marketing-studio / ad_reference are reachable from the public Cloud REST API — or only via the interactive MCP — is the single load-bearing unknown.** Design below assumes the model-ID-routed Cloud REST surface with Bearer auth and a workspace key; we isolate every uncertain detail behind one adapter so confirming the contract is a localized change, not a redesign.

> **Decision: build to the Cloud REST API directly (TS `fetch`), NOT the Python SDK.** SocialFly is Next.js/TS on Vercel serverless; pulling in a Python runtime is a non-starter. The REST surface is simple (POST submit, GET poll) and matches how `image-router.ts` already calls Stability's raw REST. If the Cloud REST API turns out to NOT expose soul_id/marketing-studio (MCP-only), the honest fallback is an **operator/worker that holds a Higgsfield session** (a separate long-running service or Vercel cron worker that talks MCP) — flagged as Open Question #1. We do NOT block U0/U1 on that: nano_banana/seedream/seedance image+video are almost certainly on the plain REST surface.

### 2.2 The `HiggsfieldProvider` — slots behind the existing router seam

New file `src/lib/engine/providers/higgsfield.ts` — a single adapter encapsulating ALL Higgsfield specifics (auth, base URL, model IDs, submit/poll, soul_id injection). It exposes three functions matching the routers' existing `generateWithX` signatures:

```ts
// src/lib/engine/providers/higgsfield.ts
export async function higgsfieldGenerateImage(
  prompt: string, aspectRatio: string, opts?: HiggsfieldImageOpts
): Promise<GeneratedImage>      // opts: { soulId?, brandKitStyleId?, model?, referenceImages? }

export async function higgsfieldGenerateVideo(
  prompt: string, imageUrl: string | undefined, params?: VideoGenParams & HiggsfieldVideoOpts
): Promise<GeneratedVideo>      // opts: { soulId?, hookId?, adReferenceId?, model? }

export async function higgsfieldGenerateAudio(
  text: string, opts?: HiggsfieldAudioOpts
): Promise<GeneratedAudio>      // inworld_text_to_speech voice

// The shared async engine — the ONLY place that knows the REST contract:
async function submitAndPoll(model: string, args: Record<string, unknown>, opts?: {
  webhookUrl?: string; maxWaitMs?: number; idempotencyKey?: string
}): Promise<HiggsfieldResult>
```

`submitAndPoll` = `POST /v1/generations {model, ...args}` → `{id}` → loop `GET /v1/generations/{id}` every ~5s until `completed|failed`, honoring a `maxWaitMs` budget (default ~240s to stay under Vercel's 300s) and surfacing `failed/NSFW/cancelled` as typed errors. It mirrors `fal.subscribe`'s ergonomics so the routers don't learn a new shape. It must:
- read creds from `getConfig().higgsfieldApiKey` (+ optional secret),
- pass an **idempotency key** (Section 5) on submit,
- **persist the job id** to a new `generation_jobs` row immediately after submit (so a serverless timeout can be resumed by a poller cron rather than lost),
- upload/normalize the output to Supabase storage if it returns a transient URL (same pattern as `generateWithStability`).

### 2.3 Router changes (minimal, additive — current providers KEPT as fallback)

**types.ts** (one line each):
```ts
export type ImageProvider = 'auto' | 'higgsfield' | 'fal' | 'nanobanana' | 'dalle' | 'stability'
export type VideoProvider = 'auto' | 'higgsfield' | 'seedance' | 'kling' | 'ltx' | 'minimax'
export type AudioProvider = 'higgsfield' | 'elevenlabs'
```

**image-router.ts / video-router.ts:**
1. Add a `higgsfield` row to the capability matrix (high marks: textInImage 9 via gpt_image, characterConsistency 10 via soul_2/soul_cast, brand-aware via marketing_studio, cinematic 10 via veo3/seedance_2_0).
2. Add scoring: a **baseline preference bump** so Higgsfield wins ties when configured as primary (e.g. `+15` base, plus `+30` when `needsConsistency`/`soulId` present, `+25` when brand-kit/marketing keywords present). Keep all existing provider scoring untouched.
3. Add the dispatch branch in `smartGenerateImage`/`smartGenerateVideo`:
   ```ts
   if (provider === 'higgsfield') result = await higgsfieldGenerateImage(prompt, aspectRatio, { soulId, brandKitStyleId })
   ```
4. **Make Higgsfield primary by config, not by deletion:** `config.defaultImageProvider/defaultVideoProvider = 'higgsfield'` (env `DEFAULT_IMAGE_PROVIDER=higgsfield`). `pickProvider` already honors the config default first — so flipping one env var makes Higgsfield primary repo-wide, and unsetting it instantly reverts to the smart router across the old providers. **This is the kill-switch the reputation/supplier-risk brains asked for.**

**orchestra.ts:** add `higgsfield` to `BUDGET_IMAGE_PREFERENCES`/`BUDGET_VIDEO_PREFERENCES` arrays at the FRONT of each tier (`['higgsfield', 'fal', ...]`). The orchestra's existing cascading-fallback loop (`for provider of providerOrder { try... catch → next }`) then gives us **Higgsfield-primary-with-automatic-fallback for free** — it already skips providers with >50% failure rate and logs `was_fallback`. No new fallback logic needed; this is the cleanest part of the design.

**audio-router.ts:** add an `inworld` (Higgsfield TTS) branch alongside ElevenLabs; route by config default, ElevenLabs stays as fallback.

### 2.4 Async / credit / error handling

- **Async:** `submitAndPoll` with the `generation_jobs` table + a new `/api/cron/poll-jobs` cron (every minute, like publish) that resumes any `pending` jobs whose request returned before completion. For routes already at maxDuration 300s (video, automations) the inline poll usually finishes; the cron is the safety net for cold-path timeouts. If/when we confirm `webhook_url` works, add `/api/webhooks/higgsfield` to flip job rows to `completed` and drop polling latency — but poll-first is the robust default (webhooks need a public verified URL + signature check).
- **Credit accounting (two ledgers):** SocialFly's OWN `deductCredits()` (user-facing billing) is unchanged — Higgsfield image still costs the user `image_generate` credits. SEPARATELY, Higgsfield bills OUR workspace credits per generation. We must track the latter in `generation_jobs.hf_credits_spent` and surface it in the existing `provider_performance`/`getSpendReport` flow (add `higgsfield` cost constants to orchestra's `IMAGE_COSTS`/`VIDEO_COSTS`). A nightly check against the MCP/`balance` endpoint guards against silent depletion (Risk §5).
- **Error/timeout/degradation:** typed errors from `submitAndPoll` (`HF_TIMEOUT`, `HF_NSFW`, `HF_RATE_LIMIT`, `HF_FAILED`). The orchestra loop already catches and falls back to FAL/etc. For the pipeline path (which lacks a fallback loop), wrap `higgsfieldGenerateImage` in a try/catch that falls back to `smartGenerateImage` with `preferredProvider:'fal'`. 429 → exponential backoff inside `submitAndPoll`; persistent 429/timeout → fall back + emit a "Higgsfield degraded" insight.

---

## 3. THE "BRAND DNA" + SOUL / PERFORMANCE LAYER (the moat)

### 3.1 The problem today
`brand.ts` is text-only and never touches the pixels (§1.5). Higgsfield gives us three identity primitives the strategy/product brains called the moat: **soul_id** (same face/persona across every post), **brand-kit-aware** DTC ad generation (logo/colors/fonts folded into the prompt), and **ad_reference** (clone a proven viral ad). To exploit them, each tenant needs a persistent *Soul ledger*: who this account IS (identity) + what has WORKED (memory). That ledger, injected into every generation, is what competitors can't copy because it compounds per-account.

### 3.2 Data model (new tables — additive, layered ON existing `brand_profiles`/`brand_kits`)

```sql
-- 020_soul_ledger.sql

-- One "soul" (persona identity) per brand. Holds the Higgsfield handles.
CREATE TABLE public.brand_souls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  -- Higgsfield identity handles (the load-bearing bit)
  hf_soul_id      TEXT,          -- soul_2 / soul_cast persona id (same face every post)
  hf_brand_kit_id TEXT,          -- marketing_studio brand kit / style_id
  hf_character_id TEXT,          -- show_characters consistent character
  reference_image_ids JSONB DEFAULT '[]',  -- uploaded media_ids for refs/ad_reference
  -- Persona definition (the "who")
  persona_name    TEXT,
  persona_visual_desc TEXT,      -- "30s founder, warm, minimal studio lighting"
  voice_id        TEXT,          -- inworld/elevenlabs voice for this persona
  default_aspect  TEXT DEFAULT '9:16',
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','training','ready','failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id)               -- one active soul per brand (v1)
);

-- The "memory" — every generation + how it performed. Feeds the virality gate.
CREATE TABLE public.soul_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soul_id         UUID NOT NULL REFERENCES public.brand_souls(id) ON DELETE CASCADE,
  post_id         UUID REFERENCES public.scheduled_posts(id) ON DELETE SET NULL,
  modality        TEXT NOT NULL,          -- image|video|audio
  hf_model        TEXT,                   -- e.g. seedance_2_0
  prompt          TEXT,
  hook_id         TEXT,                   -- which Higgsfield hook/preset was used
  ad_reference_id TEXT,
  virality_score  NUMERIC,                -- from virality_predictor (pre-publish)
  engagement_rate NUMERIC,                -- actual (post-publish, backfilled)
  outcome         TEXT,                   -- winner|loser|neutral (derived)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_soul_memory_soul ON public.soul_memory(soul_id, created_at DESC);

-- generation_jobs: async job tracking (also serves §2.4 poll/resume)
CREATE TABLE public.generation_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soul_id         UUID REFERENCES public.brand_souls(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL DEFAULT 'higgsfield',
  hf_job_id       TEXT,                   -- Higgsfield /v1/generations id
  idempotency_key TEXT UNIQUE,            -- dedup double submits
  modality        TEXT, model TEXT,
  status          TEXT DEFAULT 'pending', -- pending|processing|completed|failed
  result_url      TEXT,
  hf_credits_spent NUMERIC,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```
All three get the same RLS pattern as `brand_kits` (migration 015) for multi-tenant isolation.

### 3.3 How brand.ts evolves (static profile → injected DNA)
`brand.ts` grows a second loader without breaking the existing string one:
```ts
// existing — keep, used by all text prompts
export async function loadBrandVoice(userId, brandId?): Promise<BrandVoice|null>

// NEW — the visual/identity DNA for media generation
export interface BrandDNA extends BrandVoice {
  soulId?: string          // hf_soul_id
  brandKitId?: string      // hf_brand_kit_id
  characterId?: string
  colors?: { primary; secondary; accent }   // from brand_kits/brand_profiles
  imageStyle?: string
  voiceId?: string
  defaultAspect?: string
}
export async function loadBrandDNA(userId, brandId?): Promise<BrandDNA|null>
  // joins brand_profiles + brand_kits + brand_souls
export function buildVisualBrandContext(dna: BrandDNA): string
  // colors/style/persona phrasing appended to image/video prompts when no soul_id route exists
```

### 3.4 Injection path (one wiring change, everywhere benefits)
The clean seam: `pipeline.generateAndPublish` and `orchestra.orchestrateContent` already `loadBrandVoice(userId, brandId)`. Change that to `loadBrandDNA`, then pass `dna.soulId`/`dna.brandKitId`/`dna.imageStyle` into `smartGenerateImage`/`smartGenerateVideo` options → which forward to `higgsfieldGenerateImage({ soulId, brandKitStyleId })`. Because autopilot/automations all funnel through these two entry points (§1.4), **wiring it once makes every autopilot post on-persona, on-brand-color, with the same face.** When `soul_id` is absent (free tier / no soul trained), the router falls back to `buildVisualBrandContext` text injection + the old providers — graceful degradation, no hard dependency.

### 3.5 Performance loop (the "memory" closing)
- **Pre-publish:** when a video is generated, call Higgsfield `virality_predictor` → store `virality_score` in `soul_memory`; the autopilot virality gate (rung U4) regenerates or down-ranks below a threshold.
- **Post-publish:** the existing engagement cron (`/api/cron/engagement`, 6h) backfills `engagement_rate` + derives `outcome`. Future generations bias toward `winner` hooks/models per soul (a per-tenant bandit) — this is the compounding moat, built on tables we already log into (`provider_performance` pattern).

---

## 4. INCREMENTAL BUILD LADDER (Incremental Build Gate — smallest first, E2E each rung)

Each rung: **the change → the E2E check → the gate to advance.** No rung lands without the prior rung green.

**U0 — HiggsfieldProvider behind image-router; ONE on-brand image E2E.**
- Change: add `higgsfieldApiKey` to config; create `providers/higgsfield.ts` `higgsfieldGenerateImage` + `submitAndPoll`; add `higgsfield` to image-router matrix/scoring/dispatch + types. `DEFAULT_IMAGE_PROVIDER` left as-is (opt-in via `preferredProvider:'higgsfield'`).
- E2E: a script/route calls `smartGenerateImage({ prompt, preferredProvider:'higgsfield' })` → returns a real Higgsfield image URL persisted to Supabase storage. Old FAL path still works when not preferred.
- Gate: image renders, stored, < timeout; **fallback to FAL verified** by forcing a Higgsfield error. ⚠️ blocked on Rio minting the key + confirming auth shape (§2.1).

**U1 — video-router parity.**
- Change: `higgsfieldGenerateVideo` (seedance_2_0 / veo3) + router wiring; reuse `submitAndPoll`.
- E2E: `smartGenerateVideo({ prompt, preferredProvider:'higgsfield', imageUrl })` returns a real MP4 URL within 300s. Kling/FAL fallback verified.
- Gate: video plays, stored, fallback works.

**U2 — Brand-DNA persistence + injection.**
- Change: migration `020` (brand_souls, soul_memory, generation_jobs); `loadBrandDNA`/`buildVisualBrandContext`; pipeline+orchestra switch to `loadBrandDNA` and forward `soulId`/`brandKitId`.
- E2E: a brand with `hf_soul_id` set → `generateAndPublish` produces an image/video using that soul (same face / on-brand colors), and a `soul_memory` row is written. A brand WITHOUT a soul still generates (text-context fallback).
- Gate: identity visibly consistent across 2 generations; ledger rows present; RLS isolates tenants.

**U3 — Autopilot uses Higgsfield primary.**
- Change: flip `DEFAULT_IMAGE_PROVIDER=higgsfield` + `DEFAULT_VIDEO_PROVIDER=higgsfield`; front-load `higgsfield` in orchestra budget arrays.
- **U3b** — migrate the inline generation in `/api/cron/automations` (lines 537-650) to call `smartGenerateImage/Video` instead of raw FAL, so the automation engine inherits Higgsfield + soul injection (today it bypasses the routers entirely).
- E2E: run autopilot for a seeded brand on a dry-run/draft → the produced draft post's media came from Higgsfield with the brand's soul; `generation_jobs` + `soul_memory` logged; one forced-failure run falls back to FAL and still produces a post.
- Gate: full autopilot cycle green end-to-end with kill-switch (unset env → reverts to old providers) proven.

**U4 — Virality gate.**
- Change: after video gen in pipeline/orchestra, call Higgsfield `virality_predictor`; store score; if < threshold, regenerate once (with a different hook/preset) or down-rank.
- E2E: a deliberately weak prompt scores low → system regenerates and the second attempt is the one published; score persisted to `soul_memory`.
- Gate: gate triggers measurably; no infinite-regenerate loop (cap = 1 retry); credit spend bounded.

**U5 — Performance memory → smarter routing (the moat).**
- Change: engagement cron backfills `outcome`; generation biases hook/model selection toward per-soul winners.
- E2E: seed memory with a clear winner hook → next autopilot run preferentially uses it.
- Gate: measurable bias toward winners; A/B harness (orchestra already has one) confirms lift.

**U6 — Marketing-studio / ad_reference (premium).** Only after confirming these are reachable on the Cloud REST API (else MCP-worker path). One-click DTC ads + "recreate this viral ad."

---

## 5. RISKS

1. **Async on serverless timeout.** Higgsfield video can exceed Vercel limits. Mitigation: `submitAndPoll` budgets to ~240s and **persists `hf_job_id` on submit**; `/api/cron/poll-jobs` (1-min) resumes orphaned jobs; webhook path once verified. NEVER rely on a single request holding the whole job. The 60s `image/generate` route may need bumping to 300s if Higgsfield image latency is high (verify in U0).
2. **Credit cost control (double ledger).** Higgsfield bills our workspace; users bill SocialFly credits. A runaway autopilot could drain workspace credits silently. Mitigation: track `hf_credits_spent` per job; daily balance check vs the `balance` endpoint; a configurable per-day Higgsfield spend cap in the autopilot guard (alongside `maxPostsPerDay`); auto-fallback to cheaper FAL when balance low.
3. **Idempotency.** Crons fire every minute; a retried POST without a key = double generation = double spend. Mitigation: deterministic `idempotency_key` (hash of userId+prompt+model+minute-bucket) on `generation_jobs` (UNIQUE) and on the Higgsfield submit if supported; check the table before submitting.
4. **Secrets handling.** ⚠️ Auth format unconfirmed (single Bearer vs key:secret). Store as Vercel env (`HIGGSFIELD_API_KEY`, optional `HIGGSFIELD_API_SECRET`), read ONLY via `getConfig()`, never in client bundles. The interactive MCP OAuth in THIS chat does NOT transfer to prod — prod must use a minted dashboard key (the core CEO-brief unknown).
5. **Multi-tenant isolation.** soul_id / brand_kit_id are per-tenant; a cross-tenant leak = one brand's face on another's posts. Mitigation: RLS on all new tables (mirror migration 015); `loadBrandDNA` always scoped by `userId`; `higgsfieldGenerateImage` receives soulId only from a DNA object loaded under the caller's userId — never from request input directly.
6. **Single-supplier reputation/availability risk** (raised by other brains). Mitigation is the architecture itself: Higgsfield is primary *by config*, current providers KEPT and one env var reverts. The orchestra's existing failure-rate skip (>50%) auto-degrades a flaky Higgsfield.

---

## TOP 3 RECOMMENDATIONS

1. **Build `HiggsfieldProvider` as a config-selected primary behind the existing router seam — never a rip-and-replace.** Flipping `DEFAULT_IMAGE_PROVIDER=higgsfield` makes it primary repo-wide; unsetting it reverts instantly. Current providers stay as the orchestra's automatic fallback (already coded). This is the lowest-risk way to satisfy "Higgsfield is THE engine" while keeping the supplier kill-switch the other brains demanded.
2. **Ship the Soul ledger (3 tables) at U2 and wire it through the TWO existing entry points (`loadBrandVoice`→`loadBrandDNA`).** Because autopilot and automations both funnel through `generateAndPublish`/`orchestrateContent`, one wiring change makes every automated post carry the same persona face + brand colors. That per-account identity+memory is the moat — and it costs ~3 tables and one injection point, not a rewrite.
3. **Treat async + double-credit accounting as first-class from U0** (`generation_jobs` + poll-cron + idempotency keys + `hf_credits_spent`). Retrofitting idempotency after autopilot is live = duplicate spend on every cron retry. Build the job table in U0; it pays off at every later rung.

## OPEN QUESTIONS FOR RIO

1. **Mint the production key and tell us the exact contract.** ⚠️ Top blocker. (a) Auth: single Bearer token, or `key:secret` pair? (b) Does the Cloud REST API (`api.higgsfield.ai/v1/generations`) expose **soul_id, marketing_studio/brand_kit, ad_reference, virality_predictor** — or are those MCP-only? If MCP-only, do we accept a separate operator/worker service for those premium features (U6), or scope v1 to the plain REST models (nano_banana/seedream/seedance/veo3)?
2. **Workspace credit budget + cap.** What monthly Higgsfield spend is acceptable, and what per-tenant/per-day Higgsfield spend cap should the autopilot enforce before falling back to FAL?
3. **Soul provisioning UX.** How does a brand get its soul_id — do we train it from uploaded photos at onboarding (Higgsfield character/soul_cast flow), or is soul optional until the user uploads? Decides whether U2 needs an onboarding training step.
4. **Default primary models.** For the dogfood (DropFly's own socials): image default `soul_2` vs `seedream_v4_5` vs `gpt_image`; video default `seedance_2_0` vs `veo3`? (Cost vs quality tradeoff per the workspace credit budget.)
5. **Webhook vs poll.** Do we stand up a public verified `/api/webhooks/higgsfield` (lower latency) or ship poll-only first (simpler, robust)? Recommend poll-first.

---
*Sources: [apidog Higgsfield API](https://apidog.com/blog/higgsfield-api/) · [higgsfield-client GitHub](https://github.com/higgsfield-ai/higgsfield-client) · [Higgsfield Cloud](https://cloud.higgsfield.ai/). Live MCP (this session, read-only) for the model zoo + credit model. Code refs read directly from `src/lib/engine/*`, `src/app/api/*`, `supabase/migrations/*`.*
