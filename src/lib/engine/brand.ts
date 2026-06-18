/**
 * Brand Voice Management
 *
 * Load and apply brand voice profiles to content generation.
 */

import { getSupabase } from './config'
import type {
  BrandVoice,
  BrandDNA,
  UpsertBrandDNAInput,
  GenerationJob,
  RecordGenerationJobInput,
  SoulMemoryRow,
  RecordSoulMemoryInput,
  Platform,
  BrandDNAVoice,
  BrandDNAVisual,
  BrandDNAPlatformPolicy,
  SoulMemoryMetrics,
  CapabilityBrandDNA,
} from './types'

/**
 * Load a brand voice profile by ID.
 * If no ID provided, loads the user's default brand.
 */
export async function loadBrandVoice(
  userId: string,
  brandId?: string
): Promise<BrandVoice | null> {
  const supabase = getSupabase()

  let query = supabase
    .from('brand_profiles')
    .select('id, name, voice_tone, voice_description, voice_vocabulary, target_audience, industry, hashtag_sets')
    .eq('user_id', userId)

  if (brandId) {
    query = query.eq('id', brandId)
  } else {
    query = query.eq('is_default', true)
  }

  const { data } = await query.single()
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    tone: data.voice_tone,
    description: data.voice_description || undefined,
    vocabulary: data.voice_vocabulary || [],
    targetAudience: data.target_audience || undefined,
    industry: data.industry || undefined,
    hashtagSets: data.hashtag_sets || {},
  }
}

/**
 * Build the brand context string for injection into AI prompts.
 */
export function buildBrandContext(brand: BrandVoice): string {
  const parts = [`Brand: ${brand.name}`, `Tone: ${brand.tone}`]

  if (brand.description) parts.push(`Voice: ${brand.description}`)
  if (brand.targetAudience) parts.push(`Audience: ${brand.targetAudience}`)
  if (brand.industry) parts.push(`Industry: ${brand.industry}`)
  if (brand.vocabulary?.length) parts.push(`Key words: ${brand.vocabulary.join(', ')}`)

  return parts.join('\n')
}

// ============================================================================
// Brand-DNA Soul Ledger — loader + writers (rung U2)
//
// These persist the "Soul ledger" (brand_souls / soul_memory / generation_jobs,
// migration 020). The capability engine consumes the four hf_* binding ids that
// loadBrandDNA surfaces (see docs/01-CAPABILITY-ENGINE-RESPEC.md §4.3).
//
// Storage is INJECTED for testability: the default is the repo's getSupabase()
// service client, but a mock (see scripts/test-brand-dna.ts) can be passed so
// the loader/writers are provable without a live DB or credentials.
// ============================================================================

/**
 * The narrow slice of the Supabase client these functions use. Injecting this
 * (rather than reaching for getSupabase() directly) keeps the loader/writers
 * unit-testable with a mock — same DI seam the higgsfield provider uses for HTTP.
 */
export interface SoulStorageQuery {
  select: (cols: string) => SoulStorageQuery
  eq: (col: string, val: unknown) => SoulStorageQuery
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
  single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
  upsert: (
    row: Record<string, unknown>,
    opts?: { onConflict?: string }
  ) => SoulStorageQuery
  insert: (row: Record<string, unknown>) => SoulStorageQuery
}

export interface SoulStorage {
  from: (table: string) => SoulStorageQuery
}

/** Default storage = the repo's service-role Supabase client. */
function defaultStorage(): SoulStorage {
  return getSupabase() as unknown as SoulStorage
}

// --- mapping helpers (row <-> domain) ---------------------------------------

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return []
}

function rowToBrandDNA(row: Record<string, unknown>): BrandDNA {
  const voice = (row.voice ?? {}) as Record<string, unknown>
  const visual = (row.visual ?? {}) as Record<string, unknown>
  const policy = (row.platform_policy ?? {}) as Record<string, unknown>

  const dnaVoice: BrandDNAVoice = {
    tone: asStringArray(voice.tone),
    do: asStringArray(voice.do),
    dont: asStringArray(voice.dont),
  }
  const dnaVisual: BrandDNAVisual = {
    background: typeof visual.background === 'string' ? visual.background : undefined,
    text: typeof visual.text === 'string' ? visual.text : undefined,
    brandGradient: asStringArray(visual.brand_gradient ?? visual.brandGradient),
    aesthetic: asStringArray(visual.aesthetic),
    avoid: asStringArray(visual.avoid),
  }
  const dnaPolicy: BrandDNAPlatformPolicy = {
    primary: asStringArray(policy.primary) as Platform[],
    secondary: asStringArray(policy.secondary) as Platform[],
    postCadenceTarget:
      typeof policy.post_cadence_target === 'string'
        ? policy.post_cadence_target
        : (typeof policy.postCadenceTarget === 'string' ? policy.postCadenceTarget : undefined),
    aiDisclosure:
      typeof policy.ai_disclosure === 'string'
        ? policy.ai_disclosure
        : (typeof policy.aiDisclosure === 'string' ? policy.aiDisclosure : undefined),
  }

  return {
    id: String(row.id),
    brandName: String(row.brand_name ?? ''),
    tagline: (row.tagline as string) ?? undefined,
    oneLiner: (row.one_liner as string) ?? undefined,
    positioning: (row.positioning as string) ?? undefined,
    voice: dnaVoice,
    visual: dnaVisual,
    platformPolicy: dnaPolicy,
    contentPillars: asStringArray(row.content_pillars),
    audience: asStringArray(row.audience),
    higgsfield: {
      soulId: (row.hf_soul_id as string) ?? null,
      brandKitId: (row.hf_brand_kit_id as string) ?? null,
      brandKitStyleId: (row.hf_brand_kit_style_id as string) ?? null,
      referenceElementIds: asStringArray(row.hf_reference_element_ids),
    },
    createdAt: (row.created_at as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  }
}

/**
 * Load a brand's DNA (the brand_souls row) → BrandDNA, surfacing the four
 * Higgsfield binding ids the capability engine injects. Returns null cleanly
 * when no row exists (free tier / brand without a trained Soul → degrade path).
 */
export async function loadBrandDNA(
  userId: string,
  storage: SoulStorage = defaultStorage(),
  brandSoulId?: string
): Promise<BrandDNA | null> {
  let query = storage.from('brand_souls').select('*').eq('user_id', userId)
  if (brandSoulId) query = query.eq('id', brandSoulId)

  const { data } = await query.maybeSingle()
  if (!data) return null
  return rowToBrandDNA(data)
}

/**
 * Map a loaded BrandDNA → the capability engine's CapabilityBrandDNA binding object
 * (the four hf_* ids + the brand soul row id + a free-text aesthetic for the
 * degrade-with-flag context). Returns undefined when dna is null so the engine's
 * zero-behavior-change path fires cleanly. (rung U3)
 */
export function brandDNAToCapabilityBinding(dna: BrandDNA | null): CapabilityBrandDNA | undefined {
  if (!dna) return undefined
  return {
    brandSoulId: dna.id,
    soulId: dna.higgsfield.soulId,
    brandKitId: dna.higgsfield.brandKitId,
    brandKitStyleId: dna.higgsfield.brandKitStyleId,
    referenceElementIds: dna.higgsfield.referenceElementIds,
    imageStyle: dna.visual.aesthetic.join(', ') || undefined,
  }
}

/**
 * Upsert a brand's DNA. Maps the domain input → the brand_souls row shape and
 * upserts on id (the trigger keeps updated_at fresh). Returns the saved BrandDNA.
 */
export async function upsertBrandDNA(
  userId: string,
  input: UpsertBrandDNAInput,
  storage: SoulStorage = defaultStorage()
): Promise<BrandDNA> {
  const row: Record<string, unknown> = {
    user_id: userId,
    brand_name: input.brandName,
  }
  if (input.id !== undefined) row.id = input.id
  if (input.brandProfileId !== undefined) row.brand_profile_id = input.brandProfileId
  if (input.tagline !== undefined) row.tagline = input.tagline
  if (input.oneLiner !== undefined) row.one_liner = input.oneLiner
  if (input.positioning !== undefined) row.positioning = input.positioning
  if (input.voice !== undefined) row.voice = input.voice
  if (input.visual !== undefined) {
    // accept either camelCase domain keys or snake_case; store as-given.
    row.visual = input.visual
  }
  if (input.platformPolicy !== undefined) row.platform_policy = input.platformPolicy
  if (input.contentPillars !== undefined) row.content_pillars = input.contentPillars
  if (input.audience !== undefined) row.audience = input.audience
  if (input.hfSoulId !== undefined) row.hf_soul_id = input.hfSoulId
  if (input.hfBrandKitId !== undefined) row.hf_brand_kit_id = input.hfBrandKitId
  if (input.hfBrandKitStyleId !== undefined) row.hf_brand_kit_style_id = input.hfBrandKitStyleId
  if (input.hfReferenceElementIds !== undefined) row.hf_reference_element_ids = input.hfReferenceElementIds

  const { data, error } = await storage
    .from('brand_souls')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) throw error
  return rowToBrandDNA((data ?? row) as Record<string, unknown>)
}

/** Build the generation_jobs insert/upsert row from a write input. */
function generationJobRow(input: RecordGenerationJobInput): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: input.userId,
    capability: input.capability,
    engine: input.engine ?? 'higgsfield',
    status: input.status ?? 'pending',
    params: input.params ?? {},
  }
  if (input.brandSoulId !== undefined) row.brand_soul_id = input.brandSoulId
  if (input.tool !== undefined) row.tool = input.tool
  if (input.model !== undefined) row.model = input.model
  if (input.mediaType !== undefined) row.media_type = input.mediaType
  if (input.hfJobId !== undefined) row.hf_job_id = input.hfJobId
  if (input.resultUrl !== undefined) row.result_url = input.resultUrl
  if (input.hfCreditsSpent !== undefined) row.hf_credits_spent = input.hfCreditsSpent
  if (input.error !== undefined) row.error = input.error
  if (input.idempotencyKey !== undefined) row.idempotency_key = input.idempotencyKey
  return row
}

function rowToGenerationJob(row: Record<string, unknown>): GenerationJob {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    brandSoulId: (row.brand_soul_id as string) ?? null,
    capability: String(row.capability ?? ''),
    engine: String(row.engine ?? 'higgsfield'),
    tool: (row.tool as string) ?? null,
    model: (row.model as string) ?? null,
    mediaType: (row.media_type as GenerationJob['mediaType']) ?? null,
    hfJobId: (row.hf_job_id as string) ?? null,
    status: String(row.status ?? 'pending'),
    params: (row.params as Record<string, unknown>) ?? {},
    resultUrl: (row.result_url as string) ?? null,
    hfCreditsSpent: (row.hf_credits_spent as number) ?? null,
    error: (row.error as string) ?? null,
    idempotencyKey: (row.idempotency_key as string) ?? null,
    createdAt: (row.created_at as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  }
}

/**
 * Record (or upsert) a generation_jobs row. When an idempotency_key is present
 * the write upserts on it, so a cron retry with the same key NEVER double-spends
 * — it updates the existing row instead of inserting a duplicate.
 */
export async function recordGenerationJob(
  input: RecordGenerationJobInput,
  storage: SoulStorage = defaultStorage()
): Promise<GenerationJob> {
  const row = generationJobRow(input)

  const builder = input.idempotencyKey
    ? storage.from('generation_jobs').upsert(row, { onConflict: 'idempotency_key' })
    : storage.from('generation_jobs').insert(row)

  const { data, error } = await builder.select('*').single()
  if (error) throw error
  return rowToGenerationJob((data ?? row) as Record<string, unknown>)
}

/** Build the soul_memory insert row from a write input. */
function soulMemoryRow(input: RecordSoulMemoryInput): Record<string, unknown> {
  const metrics: SoulMemoryMetrics = input.metrics ?? {}
  const row: Record<string, unknown> = {
    user_id: input.userId,
    brand_soul_id: input.brandSoulId,
    platform: input.platform,
    metrics,
  }
  if (input.generationJobId !== undefined) row.generation_job_id = input.generationJobId
  if (input.niche !== undefined) row.niche = input.niche
  if (input.format !== undefined) row.format = input.format
  if (input.hookType !== undefined) row.hook_type = input.hookType
  if (input.opener !== undefined) row.opener = input.opener
  if (input.audioId !== undefined) row.audio_id = input.audioId
  if (input.captionStyle !== undefined) row.caption_style = input.captionStyle
  if (input.lengthSeconds !== undefined) row.length_seconds = input.lengthSeconds
  if (input.postTime !== undefined) row.post_time = input.postTime
  if (input.capability !== undefined) row.capability = input.capability
  if (input.model !== undefined) row.model = input.model
  return row
}

function rowToSoulMemory(row: Record<string, unknown>): SoulMemoryRow {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    brandSoulId: String(row.brand_soul_id ?? ''),
    generationJobId: (row.generation_job_id as string) ?? null,
    platform: (row.platform as Platform) ?? '',
    niche: (row.niche as string) ?? null,
    format: (row.format as string) ?? null,
    hookType: (row.hook_type as string) ?? null,
    opener: (row.opener as string) ?? null,
    audioId: (row.audio_id as string) ?? null,
    captionStyle: (row.caption_style as string) ?? null,
    lengthSeconds: (row.length_seconds as number) ?? null,
    postTime: (row.post_time as string) ?? null,
    capability: (row.capability as string) ?? null,
    model: (row.model as string) ?? null,
    metrics: (row.metrics as SoulMemoryMetrics) ?? {},
    createdAt: (row.created_at as string) ?? undefined,
  }
}

/**
 * Append a soul_memory row — one per published-post outcome. This is the
 * append-only ledger the learning loop (U5) mines for winning hooks/formats.
 * Exposed builder (soulMemoryRow) is used by the contract test to prove the
 * insert row is shaped correctly without a DB.
 */
export async function recordSoulMemory(
  input: RecordSoulMemoryInput,
  storage: SoulStorage = defaultStorage()
): Promise<SoulMemoryRow> {
  const row = soulMemoryRow(input)
  const { data, error } = await storage.from('soul_memory').insert(row).select('*').single()
  if (error) throw error
  return rowToSoulMemory((data ?? row) as Record<string, unknown>)
}

// Internal row-builders exported for the contract test (mock-provable shape).
export const __soulLedgerInternals = {
  generationJobRow,
  soulMemoryRow,
  rowToBrandDNA,
}
