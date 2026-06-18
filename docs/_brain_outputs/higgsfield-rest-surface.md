# Higgsfield REST API Surface — what the SocialFly backend can actually reach

**Question:** Which Higgsfield capabilities are reachable from a server-side Next.js backend (REST/CLI, headless), vs. interactive-MCP-only? This decides the production architecture for the 5 moat capabilities: Soul (persona consistency), brand-kit DTC (`ms_image`), Marketing-Studio video (hooks/settings/ad_reference), `virality_predictor`, and `video_analysis`.

**Method (no credits spent):** Web research + reading the official GitHub repos and SDK/CLI docs. No `generate_*`, `virality_predictor`, or `video_analysis` CREATE calls were made.

> **Status legend:** **[V]** = VERIFIED from official docs/SDK/CLI source this session (URL cited inline) · **[A]** = ASSUMED / inferred, needs a live confirmation call.

---

## TL;DR VERDICT (read this first)

**There IS a real server-side REST API — `https://api.higgsfield.ai` — and ALL FIVE moat capabilities are reachable from it without the interactive MCP.** The catch is *how* you reach them:

- The **low-level official SDKs** (`higgsfield-js`, `higgsfield-client` Python) publicly document only a *thin* surface: generic `POST /v1/generations`, `text2image/soul`, `image2video/dop`, `createSoulId`/`listSoulIds`. The advanced moat surface is **not** in their READMEs. [V]
- The **full moat surface IS officially exposed and supported headless via the `higgsfield` CLI** — which is itself a thin HTTP client over `api.higgsfield.ai`. The CLI's own docs say *"Do not call `api.higgsfield.ai` directly with curl"* and to route through the CLI binary which "handles auth, retries, polling, schema validation, and auto-uploads." [V] So the REST API exists and is complete; Higgsfield just steers integrators to the CLI as the supported client.
- **Auth is the real architectural fork**, not capability coverage. The CLI uses **device-flow login + short-lived tokens** by default, but third-party integration guides report the CLI also supports **long-lived API tokens storable as a CI secret / env var** for headless pipelines (vs. the MCP's interactive OAuth round-trip that "doesn't work well in CI"). The Python SDK and MCP both read `HF_KEY` / `HF_API_KEY`+`HF_API_SECRET`. **Whether a non-interactive long-lived key for the CLI/REST path is self-serve must be confirmed live** (see Open Questions). [A on long-lived key; V that device-flow is the documented default]

**Architecture implication:** The production backend should drive Higgsfield via a **server-side worker process that shells out to the `higgsfield` CLI (`--json`, `--wait`/poll) or calls `api.higgsfield.ai` REST directly** with a stored long-lived token — NOT the interactive MCP. The MCP is for interactive/agent sessions (Claude in chat); it is the wrong transport for an unattended Next.js backend. **No moat capability is MCP-ONLY.** The earlier "REST surface unknown — blocks router design" question (capability-catalog.md line 229) resolves to: **REST/CLI-reachable, gated only by the long-lived-auth confirmation.**

---

## 1. The official surface, by source

### 1A. `api.higgsfield.ai` — the REST base [V]
- Base URL `https://api.higgsfield.ai`, Bearer/Key auth (`Authorization: Bearer <key>`). Documented endpoints: `POST /v1/generations` (submit), `GET /v1/generations/{id}` (status), `DELETE /v1/generations/{id}` (cancel). "Over 100 models through a single endpoint structure." — apidog.com/blog/higgsfield-api [V]
- V1 endpoint paths visible in the Node SDK README: `/v1/text2image/soul`, `/v1/image2video/dop`, `/v1/speak/higgsfield`. V2 uses endpoint strings like `flux-pro/kontext/max/text-to-image`. — github.com/higgsfield-ai/higgsfield-js [V]
- Third-party model card lists image-to-video pricing: **dop-lite $0.135, dop-turbo $0.416, dop-preview $0.573** per 5s clip. — pixazo.ai/models/higgsfield [V — third-party, treat as indicative not authoritative]

### 1B. Official low-level SDKs — thin documented surface [V]
- **`higgsfield-js` (Node/TS)**: V2 client (`subscribe(endpoint, options)`, `Authorization: Key`, `KEY_ID:KEY_SECRET`) + V1 client (`generate(endpoint, params)`). V1 explicitly exposes: **`createSoulId()`** (train), **`listSoulIds()`** (reuse), `getSoulStyles()`, `getMotions()`, `uploadImage()`. → **Soul training + soul_id reuse is VERIFIED on REST via the official Node SDK.** [V] github.com/higgsfield-ai/higgsfield-js
- **`higgsfield-client` (Python)**: generic `submit()/subscribe()/status()/result()/cancel()` + uploads; example app id `bytedance/seedream/v4/text-to-image`. Reads `HF_KEY` or `HF_API_KEY`+`HF_API_SECRET`. Does NOT document the moat surface — it's a generic job-runner. [V] github.com/higgsfield-ai/higgsfield-client
- **Neither SDK README documents** Marketing Studio, `ms_image`, brand_kit, ad_reference, virality, or video analysis. Absence here ≠ absence on REST — those live behind the generic `/v1/generations` job submission and are documented via the CLI/skills instead. [V absence; A that they ride the generic endpoint]

### 1C. The `higgsfield` CLI + `skills` repo — the FULL moat surface, headless [V]
This is the load-bearing source. The CLI is "a terminal tool for generating images, videos, 3D assets, audio, and **analyzing media** using 30+ models including … **Marketing Studio, Virality Predictor**." Commands (github.com/higgsfield-ai/cli, github.com/higgsfield-ai/skills): [V]

| CLI command | Underlying capability | Notes |
|---|---|---|
| `generate create <model> --wait` | any of 30+ models | blocks until terminal, `--json` for parseable output |
| `soul-id create --name … --soul-2 --image …` | **Soul training** → returns `reference_id`/`soul_id` | reused via `--soul-id` for `text2image_soul_v2`, `soul_cinematic` |
| `marketing-studio` | **branded ads**: avatars, products, **ad references, brand kits, ad formats, DTC Ads Engine** | models `marketing_studio_video` / `marketing_studio_image`; params `--avatars --product_ids --hook_id --setting_id --mode --url --generate-audio` |
| `generate create brain_activity --video … --wait` | **Virality Predictor** | video-in / text-out: hook strength, attention, retention; returns scores + report URL |
| `product-photoshoot create` | brand product imagery (`gpt_image_2`) | 10 preset modes |
| `marketplace-cards` | marketplace product cards | |
| `generate workflow reframe --video … --aspect-ratio 9:16` | **reframe** workflow | workflows are separate from models |
| `outpaint` / upscale / remove-bg | finishing job types | exposed as job types/workflows |
| `model list` / `workflow list` | live model & workflow catalog | source of truth — never invent model names |
| `account` | **credits balance, transactions** | live cost data lives here, not in public docs |

CLI auth: `higgsfield auth login` (device-flow, persists to `~/.config/higgsfield/credentials.json`); "tokens are short-lived." [V]

---

## 2. The 5 moat capabilities — REST/MCP classification

| Moat capability | Verdict | Evidence |
|---|---|---|
| **Soul training + soul_id reuse** | **REST-AVAILABLE [V]** | Official Node SDK `createSoulId()` / `listSoulIds()`; CLI `soul-id create` + `--soul-id` reuse for `text2image_soul_v2`/`soul_cinematic`. Not MCP-bound. |
| **Brand-kit DTC (`ms_image` + style_id + brand_kit)** | **REST-AVAILABLE [V capability] / [A exact param schema]** | CLI `marketing-studio` explicitly lists "brand kits, ad formats, DTC Ads Engine"; model `marketing_studio_image`. Reachable headless. Exact REST body for `style_id`/`brand_kit_id`/`product_ids[]` needs a live `model get` to lock. |
| **Marketing-Studio video (hooks/settings/ad_reference)** | **REST-AVAILABLE [V]** | CLI `marketing-studio` / `marketing_studio_video` with `--hook_id --setting_id --avatars --product_ids` and ad references. Mutual-exclusivity (hooks/settings XOR ad_reference) noted in skill docs. Headless. |
| **`virality_predictor`** | **REST-AVAILABLE [V]** | CLI `generate create brain_activity --video … --wait` — a standard generation job over the REST endpoint. Returns scores + report URL. Not MCP-only. |
| **`video_analysis` (scene deconstruction)** | **REST-AVAILABLE [A — strong]** | CLI/skills describe the tool as "analyzing media" / "video analysis"; it is a `generate create` job type like `brain_activity`. Distinct from virality scoring. Highly likely the same REST path; the exact job-type string ID was not pinned this session — confirm via `model list`/`workflow list`. |

**Net: 4 of 5 VERIFIED REST-available, 1 (`video_analysis`) ASSUMED-strong REST-available. ZERO are MCP-only.** The prior catalog's "HIGGSFIELD-ONLY" flags (no fal fallback) still stand — that's about *supplier* lock-in, a different axis from *transport*. Supplier-lock + REST-reachable.

---

## 3. Production options (since nothing is MCP-only, this is about auth + client choice)

| Option | What it is | Cost / risk |
|---|---|---|
| **A. CLI worker (recommended)** | Server-side worker (Vercel cron/queue or a small always-on worker) shells out to `higgsfield` CLI with `--json --wait`/poll, authed by a stored long-lived token. | Lowest build cost — CLI handles auth refresh, retries, polling, schema validation, uploads. Risk: depends on confirming a **non-interactive long-lived token**; binary dependency in the runtime (won't run on edge — needs a Node/container worker, not edge functions). |
| **B. Direct REST (`api.higgsfield.ai`)** | Backend calls `POST /v1/generations` etc. directly with a Bearer key; reimplement polling/upload/schema. | More control, edge-friendly-ish, but you rebuild what the CLI gives free, AND Higgsfield's docs explicitly discourage raw curl (schema drift risk on the undocumented moat params). Use only if the long-lived key works but the CLI binary can't be deployed. |
| **C. Server-side MCP-driver (NOT recommended)** | A worker that programmatically drives the Higgsfield MCP session. | Highest cost + fragility (interactive OAuth, session state). Only justified if both A and B's long-lived auth turns out to be impossible — which the evidence says it is not. Avoid. |
| **D. Wait for REST docs** | Block on Higgsfield publishing full REST reference for the moat params. | Unnecessary — the CLI already reaches everything headless today. Don't wait. |

**Recommendation: Option A now, fall back to B if the CLI binary can't live in our deploy target.** Neither requires the MCP.

---

## 4. Pricing / credit cost per capability

**Status: still mostly ASSUMED — Higgsfield does NOT publish per-model credit costs in any official doc I found.** [V that it's absent]
- Official line: "credit-based pricing; costs vary by model, resolution, duration; check the website." — mindstudio.ai guide [V]
- The **authoritative live source is the CLI itself**, not docs: `higgsfield generate cost <model> …` (pre-flight cost) and `higgsfield account` (balance/transactions). Our per-unit numbers in capability-catalog.md (~30cr Soul train, ~1–2cr/img, etc.) remain **[A]** until pulled from `generate cost`. [V that the command exists]
- Only concrete public number found: dop image-to-video **$0.135 / $0.416 / $0.573** per 5s (lite/turbo/preview) — third-party (pixazo), maps to the legacy `dop` model, not the current Seedance/Kling/Veo lineup. Treat as a floor reference only. [V third-party]

**Action to replace ASSUMED costs with real ones (no generation needed):** run `higgsfield generate cost <model> --json` for each tier (a cost query does not spend credits) — this is the cheapest way to harden the unit economics.

---

## REST-vs-MCP verdict per moat capability (one line each)

1. **Soul (train + reuse)** → **REST [V]** (Node SDK `createSoulId`/`listSoulIds`; CLI `soul-id`).
2. **Brand-kit DTC `ms_image`** → **REST [V capability, A param schema]** (CLI `marketing-studio` DTC Ads Engine / `marketing_studio_image`).
3. **Marketing-Studio video (hooks/settings/ad_reference)** → **REST [V]** (CLI `marketing_studio_video`).
4. **`virality_predictor`** → **REST [V]** (CLI `generate create brain_activity`).
5. **`video_analysis`** → **REST [A-strong]** (CLI "analyze media" job type; confirm exact job-type ID via `model/workflow list`).
**MCP-only count: 0.**

## TOP 3 RECOMMENDATIONS

1. **Build the Higgsfield integration as a server-side CLI worker (Option A), not on the MCP.** Container/Node worker, `higgsfield … --json --wait`, long-lived token in secrets. This reaches all 5 moat capabilities headless. Design the router (capability-catalog §A) against CLI commands / `/v1/generations` — not MCP tools.
2. **Harden unit economics now, free:** pull real per-model costs via `higgsfield generate cost <model> --json` and `higgsfield account`, replacing every `[A]` credit figure in capability-catalog.md. Costs are NOT in public docs; the CLI is the only source.
3. **Pin the two soft spots with one live (non-generating) session:** (a) confirm a **non-interactive long-lived API token** for the CLI/REST path exists and is self-serve; (b) run `higgsfield model list/get` + `workflow list` to lock the exact `ms_image`/`marketing_studio_*` REST param bodies and the `video_analysis` job-type string. These are the only two items standing between "verified-strong" and "verified."

## OPEN QUESTIONS FOR RIO

1. **Long-lived auth:** Can we get a non-interactive, long-lived Higgsfield API token (not device-flow) for an unattended server? If only device-flow/short-lived exists, we need a token-refresh strategy (or accept Option C's MCP-driver pain). *This is now the single load-bearing unknown — capability is solved, auth is the remaining risk.*
2. **Deploy target for the worker:** The CLI is a binary — it needs a Node/container runtime, not Vercel edge. Are we OK adding a long-running worker (or container) alongside the Next.js app, or must everything be edge/serverless (→ pushes us to Option B direct-REST)?
3. **`video_analysis` exact job type** — confirm it's a distinct `generate create <type>` from `brain_activity` (virality) and supports external/YouTube URLs as the catalog assumes.
4. **`ms_image` REST body** — lock `style_id` (required), `brand_kit_id`, `product_ids[]`, `resolution`, `batch_size` against a live `model get`, since these aren't in any SDK README.
5. **Rate limits / concurrency** on `/v1/generations` for batch backfills — undocumented; affects the "generate-once → gate → reframe-to-all-ARs" fan-out throughput.

---

### Sources (all VERIFIED reads this session)
- github.com/higgsfield-ai/higgsfield-js (Node SDK — Soul, dop, soul-id methods, V2 auth)
- github.com/higgsfield-ai/higgsfield-client + deepwiki.com/higgsfield-ai/higgsfield-client (Python SDK — generic surface, HF_KEY auth)
- github.com/higgsfield-ai/cli (CLI commands, device-flow auth, marketing-studio/brain_activity/reframe/outpaint)
- github.com/higgsfield-ai/skills + /higgsfield-generate/SKILL.md + CLAUDE.md (model list, marketing studio modes, ms_image, brain_activity, soul-id reuse, "don't curl api.higgsfield.ai directly")
- apidog.com/blog/higgsfield-api (base URL api.higgsfield.ai, /v1/generations endpoints, Bearer auth)
- pixazo.ai/models/higgsfield (dop pricing — third-party)
- mindstudio.ai/blog/higgsfield-cli-claude-code-content-automation (CLI long-lived token vs MCP OAuth for CI; credit-based pricing, costs not public)
