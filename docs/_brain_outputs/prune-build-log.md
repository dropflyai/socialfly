# PRUNE BUILD LOG

**Rung:** E1 — Prune dead media-generation lanes (Stability / DALL-E / standalone Nano-Banana image gen)
**Date:** 2026-06-17 · **Brain:** BACKEND (x1000) · **Discipline:** Incremental Build Gate
**Scope built:** the prune + verification ONLY. NOT U3, NOT the virality gate, NOT the Replicate removal.
**Authoritative scope:** `docs/01-CAPABILITY-ENGINE-RESPEC.md` §1.3 "prune list" (verified blast radius) +
`docs/_brain_outputs/capability-engine-build-log.md`.

---

## Pre-state (verified on entry)

The bulk of the E1 image-lane prune was ALREADY applied in a prior pass and verified here on entry:
- `src/lib/engine/image-router.ts` — `generateWithStability` / `generateWithDalle` /
  `generateWithNanoBanana` dispatch branches + their capability-matrix rows were already removed.
  `PROVIDER_CAPABILITIES` is already `Record<'higgsfield' | 'fal', …>`; `pickProvider`/`smartGenerateImage`
  already dispatch only `higgsfield` (primary) → `fal` (fallback).
- `src/lib/engine/types.ts` — `ImageProvider` enum already narrowed to `'auto' | 'higgsfield' | 'fal'`.
- `src/lib/engine/config.ts` — `defaultImageProvider` cast already narrowed to `'auto' | 'higgsfield' | 'fal'`.
- `src/lib/engine/orchestra.ts` — `IMAGE_COSTS` + `BUDGET_IMAGE_PREFERENCES` already higgsfield/fal only.
- `src/app/api/tools/replicate/route.ts` — already carries the `TODO(prune)` comment.

This increment completed the two items the prior pass left behind (the orphaned `stabilityApiKey`
config field + the missing TODO at the second Replicate consumer) and a stale doc-comment.

## Lanes / symbols removed THIS increment

| Removed | File | Why safe |
|---|---|---|
| `stabilityApiKey` config assignment (`process.env.STABILITY_API_KEY` read) | `src/lib/engine/config.ts` | The `generateWithStability` lane it fed is gone; grep proved ZERO other readers. |
| `stabilityApiKey?` field on `EngineConfig` | `src/lib/engine/types.ts` | Same — dead config surface, no consumer. |
| Stale doc-comment "`mirroring generateWithStability`" | `src/lib/engine/providers/higgsfield.ts` | Referenced a now-deleted symbol; cleaned to avoid a phantom reference. |

## Re-confirmed zero external callers (grep evidence, whole src/ + app/ tree)

- **`generateWithStability` / `generateWithDalle` / `generateWithNanoBanana`** — `grep -rn` over `src/ app/`:
  remaining hits are 100% in PRUNE/doc COMMENTS only. No `import`, no call site, no enum use. ✅
- **`stabilityApiKey` / `STABILITY_API_KEY`** — after removal, `grep -rn` over `src/ app/`: only the two
  PRUNE marker COMMENTS remain. Zero functional reads. ✅
- **`ImageProvider` enum** — no `=== 'stability'|'dalle'|'nanobanana'` comparison anywhere; all uses
  resolve against `'auto'|'higgsfield'|'fal'`. ✅
- **String literals `'stability'`/`'dalle'`/`'nanobanana'`** — only one remaining, at
  `src/lib/engine/prompt-engineer.ts:416` (a prompt-FORMATTING branch, NOT a generation lane — see below).

## Config fields: removed vs LEFT

- **REMOVED:** `stabilityApiKey` / `STABILITY_API_KEY` (zero functional consumers).
- **LEFT (correctly):**
  - `openaiApiKey` / `OPENAI_API_KEY` — DALL-E image lane pruned, but OpenAI stays for TEXT (gpt-4o
    fallback, prompt-engineering helper). Still read by `src/lib/ai/openai.ts`.
  - `geminiApiKey` / `GEMINI_API_KEY` — standalone Nano-Banana GENERATION lane pruned, but the
    Nano-Banana EDIT lane (`editWithNanoBanana` → `smartEditImage`) is STILL live with a real external
    caller `src/app/api/image/edit/route.ts`. Key must stay until HF flux_2-kontext edit is wired.
  - `replicateApiToken` / `REPLICATE_API_TOKEN` — Replicate is NOT being pruned this rung; real
    consumers in `orchestra.maybeEnhanceImage` + `replicate-tools.ts` + the api route.

## Replicate — left functional, TODO markers at both consumers (task step 4)

- `src/app/api/tools/replicate/route.ts` — `TODO(prune)` comment already present (prior pass).
- `src/lib/engine/orchestra.ts` `maybeEnhanceImage` — **added** the `TODO(prune): replace with
  Higgsfield reframe/upscale/remove_bg once wired` comment this increment.
- `removeBackground` / `upscaleImage` still called by `maybeEnhanceImage`; `index.ts` re-exports intact.
  Nothing removed from Replicate.

## NOT removed (out of strict scope — flagged for a later pass)

- **`src/lib/engine/prompt-engineer.ts:416`** — `if (model === 'nanobanana' || model === 'dalle')`
  selects a natural-prose prompt format. This is a prompt-STRING formatter, NOT a media-generation lane,
  and it lives outside `image-router.ts`. Its `model` arg now only ever receives video model names
  (`recommendModel` returns `seedance`/`kling`/`ltx`) or an explicit override, so the branch is
  effectively dead for the image path — but deleting it would silently change prompt output for any
  future caller that passes those strings. LEFT intact + flagged; fold into a later prompt-engineer
  cleanup, not this prune rung.

## Verify results (E2E gate — ALL PASS)

| Check | Result |
|---|---|
| grep: no dangling FUNCTIONAL ref to any removed lane in `src/`/`app/` | ✅ only PRUNE/doc comments remain |
| `npx tsc --noEmit` | ✅ 79 errors total, **0 new src errors** (baseline: 79, ALL in `tests/e2e-production-test.spec.ts`, untouched) |
| `npm run build` | ✅ exit 0 ("Compiled successfully") |
| `scripts/test-higgsfield-provider.ts` | ✅ ALL PASS (incl. [C] default pick = `fal` when no HF key; HF wins when opted-in) |
| `scripts/test-brand-dna.ts` | ✅ ALL PASS |
| `scripts/test-capability-engine.ts` | ✅ ALL PASS (7 cases; byte-identical legacy selection still proven) |
| Sanity: image-router resolves to FAL by default (no HF key) + Higgsfield when opted-in | ✅ asserted green by provider + capability-engine tests |

No real generations run — zero cost.

## Left for the LATER Replicate prune (U6, per RESPEC §5.6)

- Wire HF `reframe`/`upscale_image`/`remove_background` adapters in `providers/higgsfield.ts`.
- Swap `orchestra.maybeEnhanceImage` `upscaleImage`/`removeBackground` → `runCapability({upscale|remove_bg})`
  behind `ENGINE_PRUNE_LEGACY_MEDIA`; keep Replicate as flag-OFF rollback for one release.
- After one stable release: delete `replicate-tools.ts`, remove `api/tools/replicate/route.ts`, drop
  `replicateApiToken` from config/types, prune `index.ts` re-exports.
- Fold the `prompt-engineer.ts:416` `nanobanana`/`dalle` formatter branch into that cleanup.
