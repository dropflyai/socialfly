/**
 * SocialFly Engine
 *
 * Standalone social media automation engine.
 * Works without Next.js - can be used by MCP servers, CLI tools, or any Node.js process.
 *
 * @example
 * import { initEngine, generateAndPublish } from '@/lib/engine'
 *
 * // Initialize with config (or auto-reads from env vars)
 * initEngine({
 *   supabaseUrl: '...',
 *   supabaseServiceKey: '...',
 *   anthropicApiKey: '...',
 *   falApiKey: '...',
 * })
 *
 * // One-shot: generate AI content + image, publish to Instagram
 * const result = await generateAndPublish({
 *   topic: 'How AI is changing small business',
 *   platforms: ['instagram'],
 *   userId: 'user-id',
 *   includeImage: true,
 * })
 */

// Config
export { initEngine, getConfig } from './config'

// Pipeline (the main entry points)
export { generateAndPublish, generatePreview } from './pipeline'

// Content & Image Generation
export { generateContent, generateImage, enhanceImagePrompt } from './generate'

// Publishing & Scheduling
export { publish, schedule, listScheduled, cancelScheduled, getPostHistory } from './publish'

// Brand Voice
export { loadBrandVoice, buildBrandContext } from './brand'

// Analytics
export { getAnalytics, getPerformanceSummary, storePostMetrics } from './analytics'

// Content Calendar
export { generateContentCalendar, getContentCalendars, executeCalendarEntry } from './calendar'

// Campaigns
export {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  addPostToCampaign,
  getCampaignMetrics,
} from './campaigns'

// Autopilot
export {
  runAutopilot,
  generateWeeklyDigest,
  getAutopilotConfig,
  saveAutopilotConfig,
} from './autopilot'

// Brand Assets & Templates
export {
  addAsset,
  listAssets,
  getAsset,
  deleteAsset,
  pickBestAsset,
  markAssetUsed,
  createTemplate,
  listTemplates,
  applyTemplate,
  saveBrandKit,
  getBrandKit,
} from './assets'

// Smart Image Router
export {
  smartGenerateImage,
  smartEditImage,
  explainRouting,
  scoreProviders,
  pickProvider,
} from './image-router'

// Types
export type {
  Platform,
  MediaType,
  ContentType,
  PostStatus,
  BrandVoice,
  GenerateContentOptions,
  GeneratedContent,
  GenerateImageOptions,
  GeneratedImage,
  PublishOptions,
  ScheduleOptions,
  PublishResult,
  FullPublishResult,
  GenerateAndPublishOptions,
  PostRecord,
  PostHistoryQuery,
  EngineConfig,
  CampaignRecord,
  CampaignMetrics,
  ContentCalendar,
  ContentCalendarEntry,
  PlatformAnalytics,
  ImageProvider,
  ImageProviderScore,
} from './types'

export type { PipelineResult } from './pipeline'
