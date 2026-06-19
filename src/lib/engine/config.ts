/**
 * SocialFly Engine Configuration
 *
 * Centralizes all configuration. Can be initialized from env vars
 * or passed explicitly (for MCP server use).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { EngineConfig } from './types'

let _config: EngineConfig | null = null
let _supabase: SupabaseClient | null = null

export function initEngine(config?: Partial<EngineConfig>): void {
  _config = {
    supabaseUrl: config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseServiceKey: config?.supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    anthropicApiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY!,
    falApiKey: config?.falApiKey || process.env.FAL_KEY!,
    geminiApiKey: config?.geminiApiKey || process.env.GEMINI_API_KEY,
    openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
    // PRUNE (E1): stabilityApiKey/STABILITY_API_KEY removed — the generateWithStability
    // image lane is gone and nothing else reads this env var (verified zero callers).
    elevenlabsApiKey: config?.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY,
    replicateApiToken: config?.replicateApiToken || process.env.REPLICATE_API_TOKEN,
    // Higgsfield Cloud REST API (image engine — additive, opt-in). When the key is
    // absent AND DEFAULT_IMAGE_PROVIDER is unset, selection is byte-identical to before.
    higgsfieldApiKey: config?.higgsfieldApiKey || process.env.HIGGSFIELD_API_KEY,
    higgsfieldApiSecret: config?.higgsfieldApiSecret || process.env.HIGGSFIELD_API_SECRET,
    higgsfieldBaseUrl: config?.higgsfieldBaseUrl || process.env.HIGGSFIELD_BASE_URL,
    higgsfieldTimeoutMs: config?.higgsfieldTimeoutMs
      ?? (process.env.HIGGSFIELD_TIMEOUT_MS ? Number(process.env.HIGGSFIELD_TIMEOUT_MS) : undefined),
    // Capability engine (rung E0 — additive, gated). When unset the engine resolves
    // byte-identically to today's per-modality routers (zero behavior change).
    engineDefaultMediaEngine: (config?.engineDefaultMediaEngine
      || process.env.ENGINE_DEFAULT_MEDIA_ENGINE
      || 'auto') as EngineConfig['engineDefaultMediaEngine'],
    enginePruneLegacyMedia: config?.enginePruneLegacyMedia
      ?? (process.env.ENGINE_PRUNE_LEGACY_MEDIA === 'true'),
    engineBreakerThreshold: config?.engineBreakerThreshold
      ?? (process.env.ENGINE_BREAKER_THRESHOLD ? Number(process.env.ENGINE_BREAKER_THRESHOLD) : undefined),
    engineBreakerCooldownMs: config?.engineBreakerCooldownMs
      ?? (process.env.ENGINE_BREAKER_COOLDOWN_MS ? Number(process.env.ENGINE_BREAKER_COOLDOWN_MS) : undefined),
    // Virality/quality GATE (rung U4 — additive, DEFAULT-OFF). When false the gate
    // never runs and the pipeline is byte-identical to today.
    engineViralityGate: config?.engineViralityGate
      ?? (process.env.ENGINE_VIRALITY_GATE === 'true'),
    engineViralityGateThreshold: config?.engineViralityGateThreshold
      ?? (process.env.ENGINE_VIRALITY_GATE_THRESHOLD ? Number(process.env.ENGINE_VIRALITY_GATE_THRESHOLD) : undefined),
    // --- Credit BUDGET CONTROL (additive, DEFAULT-SAFE; the #1 margin risk) ---
    // ENGINE_DAILY_CREDIT_CAP    → per-tenant UTC-daily credit cap (undefined = uncapped, today's behavior).
    // ENGINE_GENERATION_KILL_SWITCH=true → emergency stop: blocks ALL generation (default false).
    // ENGINE_MAX_CREDITS_PER_GEN → reject a single gen whose estimate exceeds this (undefined = none).
    engineDailyCreditCap: config?.engineDailyCreditCap
      ?? (process.env.ENGINE_DAILY_CREDIT_CAP ? Number(process.env.ENGINE_DAILY_CREDIT_CAP) : undefined),
    engineGenerationKillSwitch: config?.engineGenerationKillSwitch
      ?? (process.env.ENGINE_GENERATION_KILL_SWITCH === 'true'),
    engineMaxCreditsPerGen: config?.engineMaxCreditsPerGen
      ?? (process.env.ENGINE_MAX_CREDITS_PER_GEN ? Number(process.env.ENGINE_MAX_CREDITS_PER_GEN) : undefined),
    // PRUNE (E1): image provider enum narrowed to higgsfield/fal (others removed).
    defaultImageProvider: (config?.defaultImageProvider || process.env.DEFAULT_IMAGE_PROVIDER || 'auto') as 'auto' | 'higgsfield' | 'fal',
    defaultVideoProvider: (config?.defaultVideoProvider || process.env.DEFAULT_VIDEO_PROVIDER || 'auto') as 'auto' | 'seedance' | 'ltx' | 'minimax',
    instagramPageToken: config?.instagramPageToken || process.env.INSTAGRAM_PAGE_TOKEN,
    instagramAccountId: config?.instagramAccountId || process.env.INSTAGRAM_ACCOUNT_ID,
    facebookPageToken: config?.facebookPageToken || process.env.FACEBOOK_PAGE_TOKEN,
    facebookPageId: config?.facebookPageId || process.env.FACEBOOK_PAGE_ID,
    linkedinAccessToken: config?.linkedinAccessToken || process.env.LINKEDIN_ACCESS_TOKEN,
    linkedinPersonId: config?.linkedinPersonId || process.env.LINKEDIN_PERSON_ID,
    linkedinOrgId: config?.linkedinOrgId || process.env.LINKEDIN_ORG_ID,
  }
  _supabase = null // Reset client on re-init
}

export function getConfig(): EngineConfig {
  if (!_config) {
    initEngine() // Auto-init from env vars
  }
  return _config!
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const config = getConfig()
    _supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
  }
  return _supabase
}
