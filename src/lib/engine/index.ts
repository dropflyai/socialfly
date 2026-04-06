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

// Smart Video Router (Seedance 2.0 + Minimax + LTX)
export {
  smartGenerateVideo,
  generateVideoWithProvider,
  explainVideoRouting,
  scoreVideoProviders,
  pickVideoProvider,
  getAvailableVideoModels,
} from './video-router'

// OpenAI (GPT-4o text fallback + DALL-E 3 images)
export {
  generateContentWithOpenAI,
  analyzeWebsiteContentWithOpenAI,
  repurposeContentWithOpenAI,
  enhanceImagePromptWithOpenAI,
} from '../ai/openai'

// Smart Audio Router (ElevenLabs)
export {
  smartGenerateAudio,
  generateAudioWithVoice,
  explainAudioRouting,
  scoreAudioVoices,
  pickVoice,
  getAvailableVoices,
  getAudioStylePresets,
} from './audio-router'

// Replicate Tools (background removal, upscaling, style transfer, face swap)
export {
  removeBackground,
  upscaleImage,
  styleTransfer,
  faceSwap,
  generateWithCustomModel,
  getAvailableReplicateTools,
} from './replicate-tools'

// Newsletter-to-Content Transformer
export {
  transformNewsToContent,
  fetchTodayAINews,
  generateDailyNewsContent,
  transformNewsletterText,
} from './newsletter-transformer'

// Content Orchestra (unified orchestration layer)
export {
  orchestrateContent,
  getProviderPerformanceReport,
  getSpendReport,
} from './orchestra'

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
  VideoProvider,
  VideoProviderScore,
  GenerateVideoOptions,
  GeneratedVideo,
  AudioProvider,
  AudioProviderScore,
  AudioStyle,
  AudioFormat,
  AudioVoice,
  GenerateAudioOptions,
  GeneratedAudio,
  ReplicateToolName,
  ReplicateToolResult,
  OrchestraRequest,
  OrchestraResult,
  OrchestraTextResult,
  OrchestraImageResult,
  OrchestraVideoResult,
  OrchestraAudioResult,
  OrchestraPostProcessingResult,
  OrchestraProviderBreakdown,
  OrchestraBudget,
  OrchestraUrgency,
  OrchestraContentType,
  ProviderPerformanceRecord,
  ProviderPerformanceReport,
  SpendReport,
} from './types'

export type { PipelineResult } from './pipeline'
