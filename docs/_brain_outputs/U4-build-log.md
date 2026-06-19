# U4 BUILD LOG — Pre-publish VIRALITY / QUALITY GATE

**Brain:** BACKEND (x1000) · **Date:** 2026-06-17 · **Rung:** U4 (Incremental Build Gate)
**Scope:** ONE increment — the pre-publish virality/quality GATE + the two-phase
"predict-cheap → gate → generate-premium" flow. Did NOT build U5 (learning-loop
aggregator), U6 (trend ingestion), or U7 (mentor).

Design authority: docs/01-CAPABILITY-ENGINE-RESPEC.md §4.5 (two-phase flow) + §4.3/§4.4
(fail-soft ladder); docs/_brain_outputs/capability-catalog.md §3.2 ("predict cheap,
generate premium").

---

## 1. WHAT SHIPPED (additive, default-OFF)

| File | Change |
|---|---|
| `src/lib/engine/virality-gate.ts` | **NEW.** `scoreContent()` (resilient gate scorer) + `gatedGenerate()` (two-phase flow) + `brandDNAToGateContext()`. |
| `src/lib/ai/claude.ts` | **NEW** `judgeContentAgainstBrand()` — the PRIMARY LLM-judge (brand-fit / anti-slop / hook / platform-fit → {score, verdict, reasons}). Reuses the repo's existing Anthropic client. |
| `src/lib/engine/types.ts` | **NEW** gate types: `GateScore`, `GateVerdict`, `ScorerResult`, `ScoreContentInput`, `GateBrandContext`, `GateMediaType`. **NEW** config flags `engineViralityGate` (default false) + `engineViralityGateThreshold` (default 0.6). |
| `src/lib/engine/config.ts` | Wires `ENGINE_VIRALITY_GATE` / `ENGINE_VIRALITY_GATE_THRESHOLD` env → config (default off). |
| `src/lib/engine/pipeline.ts` | `generateAndPublish` image step: when `engineViralityGate` is ON, routes image gen through `gatedGenerate` (predict-cheap→gate→premium-on-pass). When OFF (default) the branch is skipped — byte-identical to U3. Gate failure falls through to the normal `generateBrandImage` path (never blocks). |
| `scripts/test-virality-gate.ts` | **NEW** hermetic contract test (mocked judge + predictor + generator). |

---

## 2. GATE DESIGN — resilient, NOT predictor-dependent

`scoreContent({media, mediaType, prompt, brandDNA, platform})` →
`{score 0-1, verdict: pass|revise|reject, reasons[], scorers:{judge?, predictor?}, degraded?, gateSkipped?}`.

- **PRIMARY scorer = LLM-judge** (`judgeContentAgainstBrand`, Claude). The dependable
  baseline. Works for image OR video by scoring the prompt/concept/caption against the
  Brand DNA on four axes (brand-fit, anti-slop/quality, hook strength, platform-fit).
  Threshold-configurable; maps score → pass/revise/reject.
- **ENHANCER scorer = virality_predictor** (Higgsfield, VIDEO only) — best-effort.
  Merged ONLY when it returns a real number (60% judge / 40% predictor blend, judge
  stays load-bearing). Default predictor seam = no-op `null` (returns "unavailable")
  so the gate degrades to judge-only by default instead of burning a probe per call.
- Both scorers are **injectable** (`JudgeFn` / `PredictorFn`) so the contract test runs
  with zero network and zero keys.

### Fail-soft cascade (a broken gate must NEVER block the pipeline) — §4.4
1. **predictor unavailable** → LLM-judge alone gates; `degraded=true`, still produces a verdict.
2. **judge unavailable** (no ANTHROPIC_API_KEY / parse error / outage) → `scoreContent`
   returns `{verdict:'pass', gateSkipped:true}` — the gate is SKIPPED, publish is NOT
   blocked, and a `gate_skipped` reason is logged.
3. In `gatedGenerate`, `gateSkipped` → outcome `'skipped'` but the draft media is KEPT
   (publish proceeds). Any thrown error in the gate path in the pipeline is `.catch`'d →
   falls through to the un-gated `generateBrandImage`. The pipeline always proceeds.

## 3. TWO-PHASE FLOW — `gatedGenerate` (§4.5)

- **PHASE A (cheap):** generate a DRAFT via `runCapability` at `qualityTier:'draft'`
  (FAL commodity lane, ~free).
- **PHASE B (gate):** `scoreContent(draft)`.
  - `pass` → proceed.
  - `revise` → ONE bounded re-generation with the judge's feedback folded into the
    prompt (`[REVISION — address …]`), then re-gate.
  - `reject` (after the bounded retry) → skip + log, **no premium spend**.
  - `gateSkipped` → keep draft, proceed.
- **PHASE C (premium):** runs ONLY on a passing draft when `premiumOnPass` is set —
  re-renders the WINNER once at `qualityTier:'premium'` on Higgsfield. This spends
  premium credits on exactly one proven winner (the unit-economics fix).
- **DEFAULT-OFF gate:** `gateEnabled()` is gated on `req.enabled ?? config.engineViralityGate`.
  When off, `gatedGenerate` is a pass-through: ONE standard-tier generation, outcome
  `'gate_off'`, the judge is never called. Zero behavior change.

Gate outcomes (verdict/score/reasons) are recorded onto the `generation_jobs` shape
through the existing `runCapability` → `recordGenerationJob` path (DB writes stay
deferred / mocked — no live Supabase). The persisted gate score gives U5 its signal.

## 4. PREDICTOR PROBE RESULT (cost-gated, ONE best-effort call)

Per the HARD COST GATE, exactly ONE predictor probe was attempted on the existing local
proof video `docs/proofs/dropfly-buildmachine-01.mp4` (NO new premium generation). Flow:

1. `mcp__higgsfield__media_upload` → presigned PUT URL + `media_id f9617b1a-…`.
2. `curl PUT` of the local mp4 bytes → **HTTP 200** (upload OK).
3. `mcp__higgsfield__media_confirm` (type video) → `status: uploaded` (OK).
4. `mcp__higgsfield__virality_predictor` action=create → `job_id cedea717-…` accepted.
5. `mcp__higgsfield__job_status` (sync) → **status: `failed`**, `analysis: null`
   (server-side; it DID ingest the video — `video_meta: 8s / 24fps / 192 frames` —
   but the analysis returned null and the job failed; internal model surfaced as
   `brain_activity`).

**Result: the probe FAILED (3rd recorded predictor failure).** No retry (cost gate).
This is the EXACT unreliability the design anticipated and is why the gate is built
LLM-judge-first with the predictor as a best-effort enhancer only. The probe also
proved the upload→confirm media flow works, so a future predictor adapter has a path
in once Higgsfield's predictor is reliable. Balance at start: 1432.46 cr (Ultra).

## 5. VERIFY RESULTS

- **Contract test** `scripts/test-virality-gate.ts` — **ALL PASS** (mocked judge +
  predictor + generator; no network/keys). Proves:
  (a) pass→proceed; (b) reject→ONE bounded revise→skip (no premium); (b2) revise→2nd
  clears→premium re-render runs on the winner; (c) predictor-unavailable→judge-only
  still gates; (c2) predictor available→blended; (d) judge-unavailable→`gate_skipped`,
  flow keeps the draft (NOT blocked); (e) brand-DNA→gate-context mapping; (f) gate
  default-OFF→`gate_off`, ONE standard gen, judge never called.
- **`npx tsc --noEmit`** — 79 errors, ALL in `tests/` (the pre-existing Playwright
  baseline). **0 new `src/` errors.**
- **`npm run build`** — exit **0**.
- **All existing suites PASS:** test-higgsfield-provider, test-brand-dna,
  test-capability-engine, test-u3-wiring (+ the new test-virality-gate).

## 6. WHAT A LIVE RUN NEEDS

- A real **`ANTHROPIC_API_KEY`** → the LLM-judge runs live; the gate actually gates
  (today, with no key, `scoreContent` fail-softs to `gate_skipped` and never blocks —
  verified). This is the only dependency for a working gate.
- A **working virality_predictor** (REST or a stable MCP worker) → swap the default
  `defaultPredictor` no-op for a real adapter to turn on the VIDEO enhancer blend.
  Today's probe failed, so it stays off by default (judge-only is fully functional).
- `ENGINE_VIRALITY_GATE=true` to enable the flow at the entry points (default off).

## 7. OPEN ITEMS FOR U5 (learning loop)

- The gate already records verdict/score/reasons onto the `generation_jobs` shape
  (deferred writes). U5 should join these to `soul_memory` post-outcomes to learn
  whether high gate scores correlate with real engagement (calibrate the threshold
  per Brand DNA, per platform).
- Wire `gatedGenerate` into the VIDEO path + `/api/cron/automations` (currently only
  the pipeline image step opts in) so the predict-cheap→premium credit governor covers
  video, where premium HF credits actually matter.
- Build a real predictor adapter (or a custom VLM-based virality model) once HF's is
  reliable — the gate's blend slot is ready for it.
- Feed the judge's `axes` breakdown (brandFit/quality/hook/platformFit) into soul_memory
  so U5 can learn which axis predicts winners for THIS audience.
