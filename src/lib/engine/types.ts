/**
 * SocialFly Engine Types
 *
 * Shared types for the standalone engine layer.
 * These types are independent of Next.js and can be used by the MCP server.
 */

export type Platform = 'instagram' | 'twitter' | 'tiktok' | 'facebook' | 'linkedin'
export type MediaType = 'image' | 'video' | 'carousel'
export type ContentType = 'text' | 'image_caption' | 'video_script' | 'thread'
export type PostStatus = 'draft' | 'scheduled' | 'queued' | 'posting' | 'posted' | 'partial' | 'failed' | 'cancelled'

export interface BrandVoice {
  id: string
  name: string
  tone: string
  description?: string
  vocabulary?: string[]
  targetAudience?: string
  industry?: string
  hashtagSets?: Record<string, string[]>
}

// ============================================================================
// Brand-DNA Soul Ledger (rung U2 — persistence + binding)
// Round-trips docs/brand-dna-dropfly.md and migration 020. The capability
// engine injects the four hf_* binding ids surfaced here (see
// docs/01-CAPABILITY-ENGINE-RESPEC.md §4.3 brand-DNA-bound branch).
// ============================================================================

export interface BrandDNAVoice {
  tone: string[]
  do: string[]
  dont: string[]
}

export interface BrandDNAVisual {
  background?: string
  text?: string
  brandGradient: string[]
  aesthetic: string[]
  avoid: string[]
}

export interface BrandDNAPlatformPolicy {
  primary: Platform[]
  secondary: Platform[]
  postCadenceTarget?: string
  aiDisclosure?: string
}

/** Higgsfield binding ids the engine injects into generation calls. */
export interface BrandDNAHiggsfieldBinding {
  soulId: string | null               // hf_soul_id — trained digital twin
  brandKitId: string | null           // hf_brand_kit_id — logo/colors/fonts/tone
  brandKitStyleId: string | null      // hf_brand_kit_style_id — ms_image style_id
  referenceElementIds: string[]       // hf_reference_element_ids — <<<element_id>>> array
}

/** The loaded Brand DNA object the loader returns (shape per brand-dna-dropfly.md). */
export interface BrandDNA {
  id: string
  brandName: string
  tagline?: string
  oneLiner?: string
  positioning?: string
  voice: BrandDNAVoice
  visual: BrandDNAVisual
  platformPolicy: BrandDNAPlatformPolicy
  contentPillars: string[]
  audience: string[]
  higgsfield: BrandDNAHiggsfieldBinding
  createdAt?: string
  updatedAt?: string
}

/** Write input for upsertBrandDNA (maps to the brand_souls insert row). */
export interface UpsertBrandDNAInput {
  id?: string
  brandProfileId?: string
  brandName: string
  tagline?: string
  oneLiner?: string
  positioning?: string
  voice?: Partial<BrandDNAVoice>
  visual?: Partial<BrandDNAVisual>
  platformPolicy?: Partial<BrandDNAPlatformPolicy>
  contentPillars?: string[]
  audience?: string[]
  hfSoulId?: string | null
  hfBrandKitId?: string | null
  hfBrandKitStyleId?: string | null
  hfReferenceElementIds?: string[]
}

export type GenerationJobMediaType = 'image' | 'video' | 'audio' | '3d'

/** A generation_jobs row (async HF job tracking + credit accounting). */
export interface GenerationJob {
  id: string
  userId: string
  brandSoulId?: string | null
  capability: string
  engine: string
  tool?: string | null
  model?: string | null
  mediaType?: GenerationJobMediaType | null
  hfJobId?: string | null
  status: string
  params: Record<string, unknown>
  resultUrl?: string | null
  hfCreditsSpent?: number | null
  error?: string | null
  idempotencyKey?: string | null
  createdAt?: string
  updatedAt?: string
}

/** Write input for recordGenerationJob (insert/upsert on idempotency_key). */
export interface RecordGenerationJobInput {
  userId: string
  brandSoulId?: string | null
  capability: string
  engine?: string
  tool?: string | null
  model?: string | null
  mediaType?: GenerationJobMediaType | null
  hfJobId?: string | null
  status?: string
  params?: Record<string, unknown>
  resultUrl?: string | null
  hfCreditsSpent?: number | null
  error?: string | null
  idempotencyKey?: string | null
}

/** Engagement metrics captured per published post outcome. */
export interface SoulMemoryMetrics {
  views?: number
  watchTime?: number
  retention?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  clicks?: number
  conversions?: number
}

/** A soul_memory row (append-only performance ledger the learning loop mines). */
export interface SoulMemoryRow {
  id: string
  userId: string
  brandSoulId: string
  generationJobId?: string | null
  platform: Platform | string
  niche?: string | null
  format?: string | null
  hookType?: string | null
  opener?: string | null
  audioId?: string | null
  captionStyle?: string | null
  lengthSeconds?: number | null
  postTime?: string | null
  capability?: string | null
  model?: string | null
  metrics: SoulMemoryMetrics
  createdAt?: string
}

/** Write input for recordSoulMemory (maps to the soul_memory insert row). */
export interface RecordSoulMemoryInput {
  userId: string
  brandSoulId: string
  generationJobId?: string | null
  platform: Platform | string
  niche?: string | null
  format?: string | null
  hookType?: string | null
  opener?: string | null
  audioId?: string | null
  captionStyle?: string | null
  lengthSeconds?: number | null
  postTime?: string | null
  capability?: string | null
  model?: string | null
  metrics?: SoulMemoryMetrics
}

export interface GenerateContentOptions {
  topic: string
  platforms: Platform[]
  contentType?: ContentType
  brandId?: string
  tone?: string
  includeHashtags?: boolean
  maxLength?: number
}

export interface GeneratedContent {
  id?: string
  variants: Record<string, PlatformVariant>
  contentPillar: string
  engagementHooks: string[]
  tokensUsed: number
}

export interface PlatformVariant {
  text: string
  hashtags: string[]
  suggestedMedia: string
  bestPostingTime: string
}

export interface GenerateImageOptions {
  prompt: string
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
  style?: string
  enhancePrompt?: boolean
}

export interface GeneratedImage {
  url: string
  prompt: string
  enhancedPrompt?: string
  meta?: GenerationMeta              // capability-engine routing metadata (additive, optional)
}

export interface PublishOptions {
  text: string
  platforms: Platform[]
  mediaUrls?: string[]
  mediaType?: MediaType
  userId: string
  contentId?: string
}

export interface ScheduleOptions extends PublishOptions {
  scheduledFor: string // ISO timestamp
}

export interface PublishResult {
  platform: Platform
  success: boolean
  platformPostId?: string
  error?: string
}

export interface FullPublishResult {
  success: boolean
  results: PublishResult[]
  contentId?: string
  imageUrl?: string
}

export interface GenerateAndPublishOptions {
  topic: string
  platforms: Platform[]
  userId: string
  includeImage?: boolean
  imagePrompt?: string
  imageAspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
  brandId?: string
  tone?: string
  scheduleFor?: string // ISO timestamp for scheduling instead of immediate publish
}

export interface PostHistoryQuery {
  userId: string
  status?: PostStatus | PostStatus[]
  platform?: Platform
  limit?: number
  offset?: number
  since?: string // ISO timestamp
}

export interface PostRecord {
  id: string
  platforms: Platform[]
  status: PostStatus
  scheduledFor: string
  postedAt?: string
  content: {
    text: string
    mediaUrls: string[]
    mediaType?: MediaType
  }
  platformPostIds: Record<string, string>
  platformErrors: Record<string, string>
  createdAt: string
}

export interface ScheduledPostRecord extends PostRecord {
  retryCount: number
}

export interface CampaignRecord {
  id: string
  name: string
  description?: string
  status: 'active' | 'paused' | 'completed' | 'draft'
  platforms: Platform[]
  startDate?: string
  endDate?: string
  postIds: string[]
  metrics?: CampaignMetrics
  createdAt: string
}

export interface CampaignMetrics {
  totalPosts: number
  totalImpressions: number
  totalEngagements: number
  totalClicks: number
  avgEngagementRate: number
}

export interface ContentCalendarEntry {
  date: string
  time: string
  platform: Platform
  topic: string
  contentType: ContentType
  tone?: string
  campaignId?: string
  status: 'planned' | 'scheduled' | 'posted' | 'skipped'
}

export interface ContentCalendar {
  id?: string
  entries: ContentCalendarEntry[]
  startDate: string
  endDate: string
  platforms: Platform[]
  postsPerDay: number
  themes: string[]
}

export interface PlatformAnalytics {
  platform: Platform
  followers: number
  impressions: number
  engagements: number
  clicks: number
  engagementRate: number
  topPosts: { postId: string; text: string; engagements: number }[]
  postingFrequency: number
  bestPostingTimes: string[]
}

// PRUNE (E1): nanobanana/dalle/stability removed from the image provider enum —
// Higgsfield covers those models natively (docs/01-CAPABILITY-ENGINE-RESPEC.md §1.3).
// Verified ZERO external callers. OpenAI/Gemini keys remain for TEXT/edit only.
export type ImageProvider = 'auto' | 'higgsfield' | 'fal'
export type VideoProvider = 'auto' | 'seedance' | 'kling' | 'ltx' | 'minimax'
export type AudioProvider = 'elevenlabs'
export type AudioStyle = 'narration' | 'voiceover' | 'podcast_intro' | 'ad_read'
export type AudioFormat = 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_44100'

export interface ImageProviderScore {
  provider: ImageProvider
  score: number
  reasons: string[]
}

export interface VideoProviderScore {
  provider: VideoProvider
  score: number
  reasons: string[]
}

export interface GenerateVideoOptions {
  prompt: string
  imageUrl?: string             // For image-to-video mode
  aspectRatio?: '16:9' | '9:16' | '1:1'
  duration?: number             // Seconds (5-10 default)
  enhancePrompt?: boolean
  preferredProvider?: VideoProvider
}

export interface GeneratedVideo {
  url: string
  prompt: string
  enhancedPrompt?: string
  provider: string
  model: string
  durationSeconds?: number
  meta?: GenerationMeta              // capability-engine routing metadata (additive, optional)
}

export interface AudioVoice {
  id: string
  name: string
  gender: 'male' | 'female' | 'neutral'
  tone: string                    // e.g. 'warm', 'authoritative', 'energetic', 'calm'
  bestFor: AudioStyle[]           // Which styles this voice excels at
  accent?: string                 // e.g. 'american', 'british', 'australian'
  description?: string
}

export interface AudioProviderScore {
  provider: AudioProvider
  score: number
  reasons: string[]
}

export interface GenerateAudioOptions {
  text: string
  voiceId?: string                // Explicit ElevenLabs voice ID
  brandId?: string                // Use brand voice profile to auto-select voice
  style?: AudioStyle              // narration, voiceover, podcast_intro, ad_read
  speed?: number                  // 0.5 - 2.0 (1.0 = normal)
  stability?: number              // 0.0 - 1.0 (higher = more consistent, less expressive)
  similarityBoost?: number        // 0.0 - 1.0 (higher = more similar to original voice)
  outputFormat?: AudioFormat
}

export interface GeneratedAudio {
  url: string
  text: string
  voiceId: string
  voiceName: string
  provider: AudioProvider
  style: AudioStyle
  durationEstimate?: number       // Estimated seconds based on text length
}

export interface EngineConfig {
  supabaseUrl: string
  supabaseServiceKey: string
  anthropicApiKey: string
  falApiKey: string
  geminiApiKey?: string           // For Nano Banana (Google Gemini)
  openaiApiKey?: string            // For OpenAI (GPT-4o text fallback; DALL-E image lane PRUNED — text only)
  // PRUNE (E1): stabilityApiKey removed with the generateWithStability lane (zero callers).
  elevenlabsApiKey?: string        // For ElevenLabs (voice/audio generation)
  replicateApiToken?: string       // For Replicate (open-source model tools)
  higgsfieldApiKey?: string        // Higgsfield Cloud key id (UUID). VERIFIED: sent as the
                                   // key half of a key:secret PAIR — NOT usable alone (see below).
  higgsfieldApiSecret?: string     // Higgsfield Cloud key secret. REQUIRED to complete auth:
                                   // the live API 500s on a key-without-secret (U0 live-verify).
  higgsfieldBaseUrl?: string       // Override Higgsfield API base URL (default platform.higgsfield.ai)
  higgsfieldTimeoutMs?: number     // Wall-clock budget for Higgsfield submit→poll
  // --- Capability engine (rung E0, additive, gated) ---
  // 'auto' (default) → byte-identical to today. 'higgsfield' → HF primary for media (U3).
  engineDefaultMediaEngine?: 'auto' | EngineId
  // false (default) → all legacy lanes still selectable, zero behavior change.
  // true → prunes Stability/DALL-E/Nano-Banana lanes from selection (later rung).
  enginePruneLegacyMedia?: boolean
  // Circuit-breaker tuning (per-engine availability) — used by the capability engine.
  engineBreakerThreshold?: number  // consecutive transient failures to trip OPEN
  engineBreakerCooldownMs?: number // OPEN cooldown before half-open probe
  // --- Virality / quality GATE (rung U4, additive, gated, DEFAULT-OFF) ---
  // false (default) → ZERO behavior change: no gate runs, existing pipeline untouched.
  // true → entry points that opt in run the predict-cheap → gate → generate-premium flow.
  engineViralityGate?: boolean
  // Pass threshold for scoreContent (0-1). Default 0.6. A draft scoring >= this passes.
  engineViralityGateThreshold?: number
  // --- Credit BUDGET CONTROL (additive, DEFAULT-SAFE) — the #1 margin risk (cost-runaway).
  // The gate sits BEFORE any provider call in the capability engine: estimate → check →
  // allow or BLOCK. When NOTHING below is configured (no cap, no kill-switch, no ceiling)
  // behavior is byte-identical to today — generation is ALLOWED, only estimates are logged.
  //
  // Per-tenant DAILY credit cap (env ENGINE_DAILY_CREDIT_CAP). A tenant's summed
  // hf_credits_spent for the UTC day + the next estimate must stay <= this. undefined =
  // uncapped (today's behavior). A safe production value is tier-derived (see budget.ts).
  engineDailyCreditCap?: number
  // GLOBAL hard KILL-SWITCH (env ENGINE_GENERATION_KILL_SWITCH=true). Emergency stop:
  // blocks ALL generation immediately, regardless of cap. Default false.
  engineGenerationKillSwitch?: boolean
  // Per-REQUEST max-credits ceiling (env ENGINE_MAX_CREDITS_PER_GEN). A single estimate
  // above this is blocked outright (stops one absurd call). undefined = no per-call ceiling.
  engineMaxCreditsPerGen?: number
  defaultImageProvider?: ImageProvider
  defaultVideoProvider?: VideoProvider
  instagramPageToken?: string
  instagramAccountId?: string
  facebookPageToken?: string
  facebookPageId?: string
  linkedinAccessToken?: string
  linkedinPersonId?: string
  linkedinOrgId?: string
}

// ============================================================================
// Capability-Aware Engine (rung E0 — docs/01-CAPABILITY-ENGINE-RESPEC.md §2-3)
//
// A thin capability-first layer OVER the existing per-modality routers. The
// orchestrator stops asking "which provider?" and asks "which capability?".
// These types are ADDITIVE: with no HIGGSFIELD_API_KEY and no brand_souls row,
// resolvePlan() resolves byte-identically to today's pickProvider() output.
// ============================================================================

/** Verb-noun the engine can perform, independent of which engine fulfills it. (§2.1) */
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
  | 'ad_reference_video'        // marketing_studio_video ad_reference_id
  | 'marketing_studio_video'    // hook_id + setting_id one-click UGC product ad
  // --- templated / preset ---
  | 'preset_i2v'                // higgsfield_preset: viral image→video templates
  // --- post-processing ---
  | 'reframe'                   // aspect-ratio re-crop, content-aware
  | 'outpaint'                  // extend canvas
  | 'upscale'                   // 2x/4x super-res (image OR video)
  | 'remove_bg'                 // transparent cutout
  // --- intelligence / analysis ---
  | 'video_analysis'           // scene-by-scene deconstruction
  | 'virality_predict'         // pre-publish oracle
  // --- 3D ---
  | 'image_to_3d'              // mesh + PBR + rigging
  // --- text (separate tier; routed to Claude/OpenAI, NOT media engines) ---
  | 'text_gen'

/** Engines (providers re-cast as engines). (§3.1) */
export type EngineId = 'higgsfield' | 'fal' | 'elevenlabs' | 'anthropic' | 'openai'

export type EngineRole =
  | 'media-primary'
  | 'media-fallback'
  | 'audio'
  | 'text-primary'
  | 'text-fallback'

export type QualityTier = 'draft' | 'standard' | 'premium'

/** Resolved brand-DNA bindings the engine injects into generation calls.
 *  ALWAYS server-loaded (via loadBrandDNA) — never raw client input. (§7 risk 6) */
export interface CapabilityBrandDNA {
  brandSoulId?: string | null     // brand_souls row id (for soul_memory FK + queue)
  soulId?: string | null          // hf_soul_id
  brandKitId?: string | null      // hf_brand_kit_id
  brandKitStyleId?: string | null // hf_brand_kit_style_id (ms_image style_id)
  referenceElementIds?: string[]  // hf_reference_element_ids
  imageStyle?: string             // free-text brand aesthetic for degrade-with-flag context
}

/** The generic capability request surface. (§2.2) */
export interface CapabilityRequest {
  capability: Capability
  prompt?: string
  inputs?: {
    imageUrl?: string
    videoUrl?: string
    referenceImages?: string[]
    referenceVideoUrl?: string
    audioUrl?: string
  }
  brandDNA?: CapabilityBrandDNA
  format?: {
    aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
    durationSec?: number
    platform?: Platform
  }
  qualityTier?: QualityTier
  budget?: { creditCeiling?: number; preferCheap?: boolean }
  preferredEngine?: EngineId
  // accounting passthrough (recordGenerationJob)
  userId?: string
  idempotencyKey?: string
  audioStyle?: AudioStyle
  /** Persist generated media to Supabase storage. Default true (production). CLI/proof
   *  runs may pass false to avoid any storage dependency (raw provider URL returned). */
  persist?: boolean
}

/** Reason a request degraded / was deferred rather than producing premium output. */
export type FailSoftReason =
  | 'no_soul'              // DNA-bound capability requested without required DNA → degrade-with-flag
  | 'queued_engine_down'  // DNA-bound + primary breaker OPEN → enqueue
  | 'gate_skipped'        // intelligence capability unavailable → skip, don't block
  | 'over_budget'         // credit ceiling exceeded and no downgrade possible

/** Routing metadata attached to every capability result (§2 output-normalization rule). */
export interface GenerationMeta {
  engine: EngineId
  model?: string
  tool?: string
  capability?: Capability
  creditsSpent?: number
  soulId?: string | null
  brandKitStyleId?: string | null
  routingScore?: number
  degraded?: FailSoftReason        // set when the fail-soft ladder fired
  gateSkipped?: boolean            // intelligence capability skipped (publish anyway)
  queued?: boolean                 // enqueued in generation_jobs, will resolve async
  jobId?: string                   // generation_jobs row id when queued/recorded
  budgetBlocked?: boolean          // the credit-budget gate STOPPED this gen (no provider call, no cascade)
  blockReason?: string             // why the budget gate blocked (kill_switch | per_request_ceiling | daily_cap)
}

/** Result of the credit-budget gate when it STOPS a generation (fail-safe degrade). */
export interface BudgetBlockedResult {
  blocked: true
  reason: string                   // kill_switch | per_request_ceiling | daily_cap
  estimatedCredits: number
  message?: string
}

/** A concrete resolved plan: (engine, model, tool) + estimate. (§4.2) */
export interface CapabilityPlan {
  engine: EngineId
  model?: string
  tool?: string
  estCredits: number
  qualityTier: QualityTier
  /** ordered fallback engine ids the cascade may try after the primary. */
  fallbacks: EngineId[]
  routingScore: number
}

/** A fail-soft outcome of resolvePlan when no runnable plan exists yet. (§4.3) */
export interface CapabilityFailSoft {
  failSoft: true
  reason: FailSoftReason
  /** a degraded plan to run instead (e.g. image_gen for an absent-soul persona req). */
  degradePlan?: CapabilityPlan
}

export type CapabilityResolution = CapabilityPlan | CapabilityFailSoft

/** The normalized result every capability returns. (§2.2) */
export interface CapabilityResult {
  url?: string                     // present for media capabilities
  prompt?: string
  provider: EngineId
  meta: GenerationMeta
  /** raw analysis payload for intelligence capabilities (virality/video_analysis). */
  analysis?: Record<string, unknown>
}

// ============================================================================
// Virality / Quality GATE (rung U4 — docs/01-CAPABILITY-ENGINE-RESPEC.md §4.5)
//
// Pre-publish gate that scores a piece of content against the Brand DNA. The
// PRIMARY scorer is an LLM-judge (reliable, works for image OR video); the
// ENHANCER is Higgsfield's virality_predictor (VIDEO only, best-effort). The
// gate is RESILIENT: predictor down → judge alone gates; judge down (no
// ANTHROPIC_API_KEY) → gate_skipped, publish is NOT blocked. (§4.4 fail-soft)
// ============================================================================

export type GateVerdict = 'pass' | 'revise' | 'reject'
export type GateMediaType = 'image' | 'video'

/** Output of a single scorer (judge or predictor). score 0-1. */
export interface ScorerResult {
  score: number                 // 0-1
  reasons: string[]
  /** present when this scorer could not run (and was skipped) — fail-soft trail. */
  unavailable?: boolean
}

/** The merged gate score for one piece of content. */
export interface GateScore {
  score: number                 // 0-1 merged score (judge, blended with predictor when present)
  verdict: GateVerdict
  reasons: string[]
  scorers: {
    judge?: ScorerResult        // LLM-judge (primary)
    predictor?: ScorerResult    // virality_predictor (video enhancer, best-effort)
  }
  /** true when a scorer failed-soft (e.g. judge unavailable → gate skipped). */
  degraded?: boolean
  /** set when the WHOLE gate was skipped (no judge available) — publish anyway. */
  gateSkipped?: boolean
}

/** Input to scoreContent — the content + the brand context to score it against. */
export interface ScoreContentInput {
  media?: string                // url of the draft (image/video) — optional for text-only
  mediaType: GateMediaType
  prompt?: string               // the generation prompt / concept being scored
  caption?: string              // platform caption (judged for hook strength)
  brandDNA?: BrandDNA | null    // resolved brand DNA the content must fit
  platform?: Platform
}

/** Brand context the gate judges against (subset of BrandDNA, mock-friendly). */
export interface GateBrandContext {
  brandName?: string
  oneLiner?: string
  voiceTone?: string[]
  voiceDo?: string[]
  voiceDont?: string[]
  aesthetic?: string[]
  avoid?: string[]
}

/** Static descriptor of an engine and the capabilities it supports. (§3.1) */
export interface EngineDescriptor {
  id: EngineId
  role: EngineRole
  supports: Capability[]
  /** capability → concrete model id (HF zoo / FAL model key). */
  models: Partial<Record<Capability, string>>
  availabilityRisk: 'low' | 'medium' | 'high'
  healthKey: string
}

// ============================================================================
// Replicate Tool Types
// ============================================================================

export type ReplicateToolName = 'remove_background' | 'upscale' | 'style_transfer' | 'face_swap' | 'custom'

export interface ReplicateToolResult {
  success: boolean
  url: string
  model: string
  tool: ReplicateToolName
  error?: string
}

// ============================================================================
// Content Orchestra Types
// ============================================================================

export type OrchestraBudget = 'low' | 'medium' | 'premium'
export type OrchestraUrgency = 'draft' | 'scheduled' | 'immediate'
export type OrchestraContentType = 'text' | 'image' | 'video' | 'audio'

export interface OrchestraRequest {
  brief: string
  brandId: string
  platforms: Platform[]
  contentTypes: OrchestraContentType[]
  style?: string
  urgency?: OrchestraUrgency
  budget?: OrchestraBudget
  abTest?: boolean
  userId?: string
  imageAspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
  audioStyle?: AudioStyle
  videoFromImage?: boolean
}

export interface OrchestraTextResult {
  content: string
  platform_variants: Record<string, PlatformVariant>
  contentPillar: string
  engagementHooks: string[]
}

export interface OrchestraImageResult {
  url: string
  provider: string
  enhanced: boolean
  cost: number
}

export interface OrchestraVideoResult {
  url: string
  provider: string
  duration: number
  cost: number
}

export interface OrchestraAudioResult {
  url: string
  voice: string
  duration: number
  cost: number
}

export interface OrchestraPostProcessingResult {
  applied: string[]
  before_url: string
  after_url: string
}

export interface OrchestraProviderBreakdown {
  provider: string
  type: string
  time_ms: number
  cost: number
  success: boolean
  error?: string
}

export interface OrchestraResult {
  text?: OrchestraTextResult
  image?: OrchestraImageResult
  video?: OrchestraVideoResult
  audio?: OrchestraAudioResult
  postProcessing?: OrchestraPostProcessingResult
  totalCost: number
  qualityScore: number
  providerBreakdown: OrchestraProviderBreakdown[]
  abTestGroup?: 'A' | 'B'
  warnings: string[]
}

export interface ProviderPerformanceRecord {
  provider: string
  content_type: string
  success: boolean
  generation_time_ms: number
  estimated_cost: number
  was_fallback: boolean
  ab_test_group?: string
  created_at?: string
}

export interface ProviderPerformanceReport {
  provider: string
  content_type: string
  total_requests: number
  success_count: number
  failure_count: number
  success_rate: number
  avg_generation_time_ms: number
  total_cost: number
  avg_cost: number
}

export interface SpendReport {
  period: string
  total_cost: number
  by_provider: { provider: string; cost: number; count: number }[]
  by_content_type: { content_type: string; cost: number; count: number }[]
}
