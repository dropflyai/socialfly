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

export type ImageProvider = 'auto' | 'fal' | 'nanobanana' | 'dalle' | 'stability'
export type VideoProvider = 'auto' | 'seedance' | 'ltx' | 'minimax'
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
  openaiApiKey?: string            // For OpenAI (GPT-4o text fallback + DALL-E 3 images)
  stabilityApiKey?: string          // For Stability AI (Stable Diffusion 3.5)
  elevenlabsApiKey?: string        // For ElevenLabs (voice/audio generation)
  replicateApiToken?: string       // For Replicate (open-source model tools)
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
