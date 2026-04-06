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
    defaultImageProvider: (config?.defaultImageProvider || process.env.DEFAULT_IMAGE_PROVIDER || 'auto') as 'auto' | 'fal' | 'nanobanana',
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
