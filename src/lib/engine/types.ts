/**
 * SocialFly Engine Types
 *
 * Shared types for the standalone engine layer.
 * These types are independent of Next.js and can be used by the MCP server.
 */

export type Platform = 'instagram' | 'twitter' | 'tiktok'
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

export interface EngineConfig {
  supabaseUrl: string
  supabaseServiceKey: string
  anthropicApiKey: string
  falApiKey: string
  instagramPageToken?: string
  instagramAccountId?: string
}
