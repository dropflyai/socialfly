# BUDGET-CONTROL BUILD LOG

## BUDGET-CONTROL BUILD LOG — rung B0 (credit cost-runaway firewall)

**Date:** 2026-06-18 · **Scope:** PURE CODE, no generation. Verified entirely with mocked tests (no network/keys).
**Why:** Cost-runaway is the #1 production margin risk (docs/02-PRICING-MODEL.md §"cost-runaway is the #1 killer — and it's LIVE"; this session burned ~1,300cr/~$62 in unsanctioned subagent generation). Real cost = **$0.0475/credit**. This increment puts a hard, fail-safe, default-safe budget gate BEFORE any provider call in the capability engine.

### Design
- New module `src/lib/engine/budget.ts` — pure + fail-safe. NEVER calls a provider, NEVER throws into the gen path, and a BLOCK means **STOP, not reroute** (must not cascade to FAL to "get around" the cap).
- Three independent controls, all **default-safe** (unconfigured → ALLOW = today's behavior, only logs the estimate):
  1. **Global kill-switch** (`ENGINE_GENERATION_KILL_SWITCH=true`) — emergency stop, blocks ALL generation, short-circuits BEFORE any spend read.
  2. **Per-request ceiling** (`ENGINE_MAX_CREDITS_PER_GEN`) — a single estimate above this is blocked outright (stops one absurd call).
  3. **Per-tenant daily cap** (`ENGINE_DAILY_CREDIT_CAP`) — `sum(hf_credits_spent today UTC) + estimate > cap` → block. Has a per-call `dailyCapOverride` hook for tier-based caps later.
- Prior-spend lookup is an **injected `DailySpendReader`** (same DI seam the rest of the engine uses), so the enforcement logic is provable with a mock and zero DB. Default reader sums `generation_jobs.hf_credits_spent` where `user_id = owner AND created_at >= startOfUtcDay`.
- Gate wired into `capability-engine.ts` `executeWithCascade()` **before both** the legacy-media path and the primary dispatch: `estimateCredits(plan)` → `checkBudget(ownerId, est)` → if blocked, `blockedResult()` records a `status='blocked'` generation_jobs row (with the reason in `error`) and returns `{ meta.budgetBlocked:true, blockReason }`. `creditsSpent=0` on a block (nothing actually spent). When allowed, the estimate is logged (auditable trail) even with no cap.

### Cost map used (from docs/_brain_outputs/pricing-finance.md §0, VERIFIED, @ $0.0475/cr)
`estimateCredits(plan)` = (model override → capability base → 2cr fallback) × tier multiplier (draft 0.4 · standard 1 · premium 2):
- cheap image (FAL commodity lane) ~0.5cr · premium image (nano_banana_pro / ms_image) 2cr
- video (seedance_2_0 22 · veo_3_1 19 · cinematic_3_0 28; capability midpoint 22cr) · TTS 2cr · music 2cr · SFX 0.4cr
- post-proc reframe/upscale/remove_bg ~1cr, outpaint 2cr · 3D 3cr · intelligence 2cr · **soul-train (one-time/persona) 30cr**
- FAL engine always treated as the cheap commodity lane (billed in $ separately, ~free in HF credits).

### Enforced NOW (proven against mock) vs needs-live-DB
- **NOW (fully proven):** kill-switch, per-request ceiling, daily-cap arithmetic, UTC day-boundary reset, no-cascade-on-block, default-safe pass-through, the cost map, and the `status='blocked'` audit write.
- **Needs-live-DB for exactness:** the real per-tenant daily spend SUM uses `defaultDailySpendReader` (a live `generation_jobs` query). The reader is fail-OPEN on a DB error (returns 0) so a DB hiccup never wedges the pipeline — the kill-switch remains the hard stop. The tier→cap mapping is a `dailyCapOverride` hook, not yet wired to a tier source.

### Env vars added (config.ts + types.ts, documented inline)
- `ENGINE_DAILY_CREDIT_CAP` → `engineDailyCreditCap` (undefined = uncapped, today's behavior)
- `ENGINE_GENERATION_KILL_SWITCH=true` → `engineGenerationKillSwitch` (default false)
- `ENGINE_MAX_CREDITS_PER_GEN` → `engineMaxCreditsPerGen` (undefined = no per-call ceiling)

### Verify results
- `scripts/test-budget.ts`: **ALL PASS** — (a) under cap → allowed; (b) crosses daily cap → BLOCKED, no provider call, `status='blocked'` recorded; (c) kill-switch → everything blocked; (d) per-request ceiling blocks oversized gen (cheap one still allowed); (e) block does NOT cascade to FAL; (f) unconfigured → allowed, spend reader never even invoked (zero behavior change); (g) UTC day boundary resets the total; (h) cost map.
- `npx tsc --noEmit`: **79 total, 0 new src errors** (baseline 79, all in tests/).
- `npm run build`: **exit 0**.
- Existing suites: test-higgsfield-provider, test-brand-dna, test-capability-engine, test-u3-wiring, test-virality-gate → **ALL PASS**.
