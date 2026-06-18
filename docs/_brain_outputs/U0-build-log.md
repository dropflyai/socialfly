# U0 BUILD LOG — HiggsfieldProvider behind image-router (image only)

**Date:** 2026-06-16 · **Rung:** U0 (Incremental Build Gate) · **Scope:** IMAGE only. Video / brand-DNA (soul_id) / autopilot are LATER rungs and were NOT built.

## Files changed
- **NEW** `src/lib/engine/providers/higgsfield.ts` — `HiggsfieldProvider` adapter. `higgsfieldGenerateImage(prompt, aspectRatio, opts)` → `submitAndPoll(model, args)` (the only code that speaks the REST contract): `POST /v1/generations` → `{id}` → poll `GET /v1/generations/{id}` until completed/failed, honoring a wall-clock budget (default 240s, under Vercel's 300s). Default model `nano_banana_pro`; accepts a `model` override. Typed `HiggsfieldError` (`HF_NO_KEY`, `HF_SUBMIT_FAILED`, `HF_POLL_FAILED`, `HF_TIMEOUT`, `HF_NSFW`, `HF_FAILED`, `HF_NO_OUTPUT`). Output persisted to Supabase storage (mirrors `generateWithStability`), degrading to the raw URL if storage is unavailable. Injectable transport (`__setHiggsfieldTransport`) for hermetic tests. **All HTTP specifics (base URL, auth header, request/response field names, model-id map, terminal-status sets) are isolated in top-of-file constants each tagged `// UNCONFIRMED until prod key minted — verify against live API`.**
- `src/lib/engine/types.ts` — `ImageProvider` now includes `'higgsfield'`; `EngineConfig` gains `higgsfieldApiKey?`, `higgsfieldBaseUrl?`, `higgsfieldTimeoutMs?`.
- `src/lib/engine/config.ts` — reads `HIGGSFIELD_API_KEY` / `HIGGSFIELD_BASE_URL` / `HIGGSFIELD_TIMEOUT_MS`; `defaultImageProvider` cast widened to include `'higgsfield'`. Default stays `'auto'` — current defaults intact.
- `src/lib/engine/image-router.ts` — additive: capability-matrix row for `higgsfield`; a scoring block **gated on `config.higgsfieldApiKey`** (base +65 primary bump, +30 consistency, +20 text/edit, +10 hi-res); dispatch branch `if (provider === 'higgsfield') → higgsfieldGenerateImage(...)`; `pickProvider` return-type cast widened. Existing providers untouched.
- **NEW** `scripts/test-higgsfield-provider.ts` — standalone tsx contract test (repo has no unit runner; matches the `scripts/*.ts` + root `test-*.mjs` pattern), mocked transport, no key/network needed.

## Verify commands + results (E2E gate — all green)
- `npx tsc --noEmit` → **0 errors in `src/`** (and in the new files). Total 79 errors are ALL pre-existing in `tests/*.spec.ts` (Playwright implicit-any), identical to the pre-U0 baseline — unchanged by this rung.
- `npm run build` (with dummy Supabase/FAL/Anthropic env so page-data collection runs) → **exit 0**: "Compiled successfully" + "Running TypeScript" pass, all routes built. (A bare `npm run build` fails at page-data collection only because no real Supabase creds exist in this env — a pre-existing environmental limitation, not a code error; the dummy-env run isolates that.)
- `npx tsx scripts/test-higgsfield-provider.ts` → **ALL PASS ✅ (12/12 assertions, exit 0)**:
  - [A] submit (POST) → poll (GET) → returns normalized `GeneratedImage` (url + prompt + enhancedPrompt); exactly one submit + one poll.
  - [B] missing key → throws typed `HiggsfieldError` with code `HF_NO_KEY`; transport never called.
  - [C] with no key + no opt-in: `higgsfield` is NOT in the scored list and `pickProvider` returns `'fal'` (zero behavior change); once the key is set it enters and wins (proves the gate is the only thing holding it out).
- Grep confirmation: higgsfield scoring is gated behind `const hasHiggsfield = !!config.higgsfieldApiKey` (image-router.ts:122-123); `defaultImageProvider` defaults to `'auto'` (config.ts:31). With `HIGGSFIELD_API_KEY` absent AND `DEFAULT_IMAGE_PROVIDER` unset, provider selection is byte-identical to pre-U0.

## Mock-proven vs needs the live key
- **Mock-proven now:** submit→poll→normalize state machine, missing-key typed fallback, error typing, zero-behavior-change gate, full repo typecheck + build.
- **Needs Rio's minted prod key (UNCONFIRMED):** real auth format (single `Bearer` vs `key:secret`), real endpoint shape (generic `/v1/generations` vs model-ID-routed), actual response field names, real `nano_banana_pro` model id, whether soul_id/marketing-studio are reachable on the public REST surface. All localized to the tagged constants in `higgsfield.ts` — confirming the contract is a one-file edit, no redesign.

## Open items for U1
- Video parity: `higgsfieldGenerateVideo` (seedance_2_0 / veo3) reusing `submitAndPoll`; wire into `video-router.ts`; verify a real MP4 within 300s + Kling/FAL fallback.
- Pipeline fallback wrap: `pipeline.generateImage()` currently calls FAL directly; re-point to `smartGenerateImage` and wrap higgsfield in try/catch → fall back to `preferredProvider:'fal'` (orchestra already has the cascading fallback loop).
- `generation_jobs` table + `/api/cron/poll-jobs` to resume serverless-timed-out jobs; idempotency key on submit; `hf_credits_spent` tracking (architecture-rd §2.4 / §5).
- Live-key smoke: real end-to-end image render persisted to storage; confirm `image/generate` route's 60s maxDuration is sufficient for Higgsfield latency (may need bump to 300s).
