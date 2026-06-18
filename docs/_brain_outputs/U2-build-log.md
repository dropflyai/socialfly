# U2 BUILD LOG — Brand-DNA Soul Ledger (persistence + loader/writers)

**Brain:** DATABASE (x1000) · **Date:** 2026-06-16 · **Rung:** U2 (the moat foundation)
**Scope (per the Incremental Build Gate):** persistence schema + loader/writers ONLY.
NOT built (deferred to later rungs): autopilot rewrite, capability-engine refactor,
virality gate, provider pruning, the `runCapability` resolver, entry-point wiring.

---

## Files changed / added

- **`supabase/migrations/020_brand_dna_soul_ledger.sql`** (NEW) — three tables
  (`brand_souls`, `generation_jobs`, `soul_memory`), RLS, indexes, idempotent.
  - Owner mechanism copied EXACTLY from 011/015/018/019:
    `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`,
    RLS `auth.uid() = user_id` for users + a `auth.role() = 'service_role'`
    FOR ALL policy (mirrors 018_credit_system.sql, since engine writers run under
    the service key). NO new tenancy model invented.
  - `gen_random_uuid()` PKs, `TIMESTAMPTZ ... DEFAULT NOW()`, `CREATE ... IF NOT EXISTS`,
    `DROP POLICY IF EXISTS` before each `CREATE POLICY` → fully re-runnable.
  - `generation_jobs` defined BEFORE `soul_memory` because `soul_memory.generation_job_id`
    FKs it. `brand_souls` first (both others FK it).
  - `brand_souls`: brand DNA + the 4 HF binding ids the engine injects
    (`hf_soul_id`, `hf_brand_kit_id`, `hf_brand_kit_style_id`,
    `hf_reference_element_ids jsonb default '[]'`). Round-trips brand-dna-dropfly.md.
  - `generation_jobs`: capability + engine(default 'higgsfield') + tool + model +
    media_type CHECK(image|video|audio|3d) + hf_job_id + status + params + result_url +
    hf_credits_spent + error + idempotency_key. **UNIQUE partial index** on
    idempotency_key (WHERE NOT NULL) so cron retries upsert, never double-spend.
    Indexes: status, hf_job_id, (user_id, created_at DESC).
  - `soul_memory`: append-only per-post ledger (platform/niche/format/hook_type/opener/
    audio_id/caption_style/length_seconds/post_time/capability/model/metrics jsonb).
    Indexes: (user_id, platform, created_at DESC) and brand_soul_id.
  - Shared `touch_updated_at()` trigger on brand_souls + generation_jobs.

- **`src/lib/engine/types.ts`** (ADDITIVE) — added `BrandDNA` (+ `BrandDNAVoice`,
  `BrandDNAVisual`, `BrandDNAPlatformPolicy`, `BrandDNAHiggsfieldBinding`),
  `UpsertBrandDNAInput`, `GenerationJob` + `RecordGenerationJobInput` +
  `GenerationJobMediaType`, `SoulMemoryRow` + `RecordSoulMemoryInput` +
  `SoulMemoryMetrics`. Zero existing exports removed.

- **`src/lib/engine/brand.ts`** (ADDITIVE) — kept `loadBrandVoice`/`buildBrandContext`;
  added `loadBrandDNA(userId, storage?, brandSoulId?)`, `upsertBrandDNA`,
  `recordGenerationJob`, `recordSoulMemory`, plus a `SoulStorage`/`SoulStorageQuery`
  DI seam (default = `getSupabase()`, injectable for testability — same pattern as the
  higgsfield provider's `__setHiggsfieldTransport`). Row↔domain mappers handle the
  snake_case↔camelCase + jsonb shape. `__soulLedgerInternals` exposes the pure
  row-builders for the contract test.

- **`src/lib/engine/index.ts`** (ADDITIVE) — re-exports the 4 new functions, the
  `SoulStorage`/`SoulStorageQuery` types, and the new domain types.

- **`scripts/test-brand-dna.ts`** (NEW) — mocked-storage contract test (no DB, no creds).

---

## Verify commands + results (E2E gate — ALL PASS)

1. **`npx tsc --noEmit`** → **0 NEW errors in src/**. Baseline = 79 errors, ALL in
   `tests/*.spec.ts` (pre-existing, implicit-any `page`). After U2: still 79 total,
   0 outside `tests/`. My src/ + scripts/ changes add zero type errors.

2. **`npm run build`** → **exit 0**, "✓ Compiled successfully in 3.2s", full route
   table built. Ran with dummy env (same approach as the U0 build):
   `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY + FAL_KEY`
   set to dummy values so page-data collection runs without real creds.

3. **`npx tsx scripts/test-brand-dna.ts`** → **ALL PASS ✅ (44 assertions)**:
   - [A] `loadBrandDNA` maps a fake `brand_souls` row → correct `BrandDNA`, including
     ALL FOUR HF binding fields (soulId/brandKitId/brandKitStyleId/referenceElementIds);
     verified it queries `brand_souls` and scopes by `user_id`.
   - [B] `recordSoulMemory` builds the correct append-only insert row (snake_cases all
     fields, nests metrics jsonb, defaults metrics to `{}`, omits unset columns).
   - [C] `generation_jobs` idempotency_key present → `upsert(onConflict='idempotency_key')`,
     no throw (cron-retry-safe, no double-spend); no key → plain `insert`.
   - [D] `loadBrandDNA` returns `null` cleanly when no row (the degrade-with-flag path).

4. **Migration SQL** — valid, idempotent, matches 015/018/019 style. Structural check:
   3 CREATE TABLE IF NOT EXISTS, 3 ENABLE RLS, 11 DROP POLICY + 11 CREATE POLICY
   (balanced), 3 service-role policies, FK ordering correct
   (brand_souls → generation_jobs → soul_memory).

---

## Mock-proven vs needs-live-DB

- **Mock-proven (no DB):** the loader's row→`BrandDNA` mapping incl. all 4 HF bindings;
  the writers' domain→row shaping; idempotency upsert-vs-insert branching; null-when-absent.
  All hermetic via the injected `SoulStorage` mock — no DB, no network, no creds.
- **Needs live DB (DEFERRED, same as prior rungs):** actually applying migration 020 to
  Supabase; that RLS truly isolates cross-tenant reads at the DB layer; that the UNIQUE
  idempotency index enforces no-double-spend under real concurrent cron retries; that the
  `touch_updated_at` trigger fires. DB-apply is deferred — no live DB in this environment.

---

## Open items for U3 / capability-engine rung / U5

- **U3 (autopilot uses HF primary):** wire `loadBrandVoice → loadBrandDNA` at the TWO
  entry points (`pipeline`, `orchestra`); forward `soulId`/`brandKitStyleId`/element ids
  into the (future) `runCapability`. Set `ENGINE_DEFAULT_MEDIA_ENGINE='higgsfield'`.
  Re-point `/api/cron/automations` inline generation (U3b).
- **Capability-engine rung (U1, parallel):** `capability-engine.ts` consumes the
  `GenerationJob` write-path built here — `recordGenerationJob` is the row the cascade's
  queue/poll branch (RESPEC §4.3/§4.4) persists. The brand-DNA-bound branch reads exactly
  the 4 HF binding ids `loadBrandDNA` now surfaces.
- **U5 (performance-memory routing — moat closes):** the `soul_memory` table + its
  (user_id, platform, created_at) index is the read surface; a `querySoulMemory` aggregator
  (winning hook/format/audio per audience) is the next writer-side addition — NOT built here.
- **Idempotency key derivation:** the column + UNIQUE index exist; the actual key formula
  (hash userId+prompt+model+minute-bucket, RESPEC risk §4) is the engine's job, not the
  ledger's — built when `runCapability` lands.
- **brand_profiles linkage:** `brand_souls.brand_profile_id` FKs the existing
  `brand_profiles` (nullable, ON DELETE SET NULL) so a Soul can attach to the legacy brand
  profile; the join in `loadBrandDNA` (profiles+kits+souls) is left for U3 wiring.
- **Credit accounting reads:** `hf_credits_spent` is captured per job; a `getSpendReport`
  over `generation_jobs` (RESPEC risk §4) is a later read-side add.
