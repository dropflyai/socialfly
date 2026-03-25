#!/usr/bin/env npx tsx
/**
 * SocialFly MCP Server
 *
 * Exposes the SocialFly engine as MCP tools for AI agents.
 * Any agent with this MCP connected can generate content, images,
 * and publish to social media platforms.
 *
 * Usage in .mcp.json:
 * {
 *   "socialfly": {
 *     "command": "npx",
 *     "args": ["tsx", "/Users/dropfly/Projects/socialfly/mcp/server.ts"],
 *     "env": {
 *       "NEXT_PUBLIC_SUPABASE_URL": "...",
 *       "SUPABASE_SERVICE_ROLE_KEY": "...",
 *       "ANTHROPIC_API_KEY": "...",
 *       "FAL_KEY": "...",
 *       "INSTAGRAM_PAGE_TOKEN": "...",
 *       "INSTAGRAM_ACCOUNT_ID": "...",
 *       "FACEBOOK_PAGE_TOKEN": "...",
 *       "FACEBOOK_PAGE_ID": "...",
 *       "LINKEDIN_ACCESS_TOKEN": "...",
 *       "LINKEDIN_PERSON_ID": "..."
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

// Load .env.local from the socialfly project root
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

// Import engine after env is loaded
import {
  initEngine,
  generateAndPublish,
  generatePreview,
  generateContent,
  generateImage,
  enhanceImagePrompt,
  publish,
  schedule,
  listScheduled,
  cancelScheduled,
  getPostHistory,
  loadBrandVoice,
  getAnalytics,
  getPerformanceSummary,
  generateContentCalendar,
  getContentCalendars,
  executeCalendarEntry,
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  addPostToCampaign,
  getCampaignMetrics,
  // Autopilot
  runAutopilot,
  generateWeeklyDigest,
  getAutopilotConfig,
  saveAutopilotConfig,
  // Brand Assets
  addAsset,
  listAssets,
  getAsset,
  deleteAsset,
  pickBestAsset,
  createTemplate,
  listTemplates,
  applyTemplate,
  saveBrandKit,
  getBrandKit,
  // Smart Image Router
  smartGenerateImage,
  smartEditImage,
  explainRouting,
  type Platform,
  type ImageProvider,
} from '../src/lib/engine/index.js'

// Initialize the engine from env vars
initEngine()

const server = new Server(
  { name: 'socialfly', version: '2.0.0' },
  { capabilities: { tools: {} } }
)

// Platform enum for all tools
const ALL_PLATFORMS = ['instagram', 'twitter', 'tiktok', 'facebook', 'linkedin']

// ============================================================================
// Tool Definitions
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Content Generation & Publishing ───────────────────────────────
    {
      name: 'generate_and_publish',
      description:
        'Generate AI content and optionally an AI image, then publish or schedule to social media. This is the main power tool - one call does everything: AI caption + AI image + publish to Instagram, Twitter, TikTok, Facebook, or LinkedIn.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description: 'The topic or prompt for the post (e.g., "How AI is transforming small business phone systems")',
          },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ALL_PLATFORMS },
            description: 'Platforms to publish to. Default: ["instagram"]',
          },
          include_image: {
            type: 'boolean',
            description: 'Generate an AI image for the post. Default: true',
          },
          image_prompt: {
            type: 'string',
            description: 'Custom image prompt. If not provided, AI will generate one based on the topic.',
          },
          image_aspect_ratio: {
            type: 'string',
            enum: ['1:1', '4:5', '9:16', '16:9'],
            description: 'Image aspect ratio. Default: "1:1". Use "4:5" for Instagram portrait, "9:16" for Stories/Reels.',
          },
          tone: {
            type: 'string',
            description: 'Content tone (e.g., "professional", "casual", "playful", "inspirational"). Default: "professional but approachable"',
          },
          brand_id: {
            type: 'string',
            description: 'Brand profile ID to use for voice/style. Optional - uses default brand if not specified.',
          },
          schedule_for: {
            type: 'string',
            description: 'ISO timestamp to schedule for (e.g., "2026-03-20T09:00:00Z"). If not provided, publishes immediately.',
          },
          campaign_id: {
            type: 'string',
            description: 'Campaign ID to associate this post with.',
          },
        },
        required: ['topic'],
      },
    },
    {
      name: 'generate_content',
      description:
        'Generate AI social media captions/text without publishing. Returns platform-specific variants with hashtags and posting time suggestions. Supports all 5 platforms.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description: 'The topic or prompt for content generation',
          },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ALL_PLATFORMS },
            description: 'Platforms to generate for. Default: ["instagram"]',
          },
          content_type: {
            type: 'string',
            enum: ['text', 'image_caption', 'video_script', 'thread'],
            description: 'Type of content. Default: "text"',
          },
          tone: { type: 'string', description: 'Content tone' },
          brand_id: { type: 'string', description: 'Brand profile ID' },
        },
        required: ['topic'],
      },
    },
    {
      name: 'generate_image',
      description:
        'Generate an AI image using FAL.ai Flux. Automatically enhances simple prompts into detailed, high-quality image generation prompts.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          prompt: {
            type: 'string',
            description: 'Image description (can be simple - will be auto-enhanced)',
          },
          aspect_ratio: {
            type: 'string',
            enum: ['1:1', '4:5', '9:16', '16:9'],
            description: 'Aspect ratio. Default: "1:1"',
          },
          enhance_prompt: {
            type: 'boolean',
            description: 'Auto-enhance the prompt with AI for better results. Default: true',
          },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'publish_post',
      description:
        'Publish pre-written content to social media platforms. Use this when you already have the text and optional media URL. Supports Instagram, Twitter, TikTok, Facebook, and LinkedIn.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          text: { type: 'string', description: 'The post text/caption' },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ALL_PLATFORMS },
            description: 'Platforms to publish to',
          },
          media_urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URLs of media to attach (images or video)',
          },
          media_type: {
            type: 'string',
            enum: ['image', 'video', 'carousel'],
            description: 'Type of media being attached',
          },
          campaign_id: { type: 'string', description: 'Campaign ID to associate this post with' },
        },
        required: ['text', 'platforms'],
      },
    },
    {
      name: 'schedule_post',
      description: 'Schedule a post for future publishing.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          text: { type: 'string', description: 'The post text/caption' },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ALL_PLATFORMS },
          },
          scheduled_for: {
            type: 'string',
            description: 'ISO timestamp for when to publish (e.g., "2026-03-20T09:00:00Z")',
          },
          media_urls: { type: 'array', items: { type: 'string' } },
          media_type: { type: 'string', enum: ['image', 'video', 'carousel'] },
          campaign_id: { type: 'string', description: 'Campaign ID' },
        },
        required: ['text', 'platforms', 'scheduled_for'],
      },
    },
    {
      name: 'list_scheduled_posts',
      description: 'List all scheduled (upcoming) posts.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Max results. Default: 20' },
          status: {
            type: 'string',
            enum: ['scheduled', 'draft', 'queued'],
            description: 'Filter by status. Default: "scheduled"',
          },
        },
      },
    },
    {
      name: 'cancel_scheduled_post',
      description: 'Cancel a scheduled post by ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          post_id: { type: 'string', description: 'The scheduled post ID to cancel' },
        },
        required: ['post_id'],
      },
    },
    {
      name: 'get_post_history',
      description: 'Get history of published and failed posts.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          status: {
            type: 'string',
            enum: ['posted', 'failed', 'partial', 'cancelled'],
            description: 'Filter by status. Default: all statuses',
          },
          platform: {
            type: 'string',
            enum: ALL_PLATFORMS,
            description: 'Filter by platform',
          },
          limit: { type: 'number', description: 'Max results. Default: 20' },
          since: { type: 'string', description: 'ISO timestamp - only show posts after this date' },
        },
      },
    },
    {
      name: 'enhance_image_prompt',
      description:
        'Take a simple image description and enhance it into a detailed, high-quality prompt for AI image generation.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          prompt: { type: 'string', description: 'Simple image description to enhance' },
          platform: { type: 'string', enum: ALL_PLATFORMS },
        },
        required: ['prompt'],
      },
    },

    // ── Analytics ─────────────────────────────────────────────────────
    {
      name: 'get_analytics',
      description:
        'Get engagement analytics across platforms — impressions, engagements, clicks, engagement rate, top posts, best posting times, and posting frequency. Filter by platform and date range.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ALL_PLATFORMS },
            description: 'Filter by platforms. Default: all platforms',
          },
          since: { type: 'string', description: 'ISO timestamp — only include data after this date' },
          until: { type: 'string', description: 'ISO timestamp — only include data before this date' },
        },
      },
    },
    {
      name: 'get_performance_summary',
      description:
        'Get a high-level performance summary across all platforms — total posts, impressions, engagements, platform breakdown, and top performing content.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days: { type: 'number', description: 'Number of days to look back. Default: 30' },
        },
      },
    },

    // ── Content Calendar ──────────────────────────────────────────────
    {
      name: 'generate_content_calendar',
      description:
        'AI-powered content calendar generator. Plans an entire week or month of posts with optimal topics, timing, and platform distribution. The killer feature for marketing automation.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ALL_PLATFORMS },
            description: 'Platforms to plan content for',
          },
          start_date: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD). Default: today',
          },
          days: {
            type: 'number',
            description: 'Number of days to plan. Default: 7 (one week). Use 30 for a month.',
          },
          posts_per_day: {
            type: 'number',
            description: 'Posts per day. Default: 1',
          },
          themes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Content themes to rotate through (e.g., ["AI tips", "customer stories", "product updates"])',
          },
          brand_id: { type: 'string', description: 'Brand profile ID' },
          tone: { type: 'string', description: 'Overall tone for the calendar' },
          campaign_id: { type: 'string', description: 'Campaign ID to associate all posts with' },
        },
        required: ['platforms'],
      },
    },
    {
      name: 'get_content_calendars',
      description: 'List existing content calendars. Optionally filter to only active calendars.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Max results. Default: 10' },
          active_only: { type: 'boolean', description: 'Only show calendars that haven\'t ended yet. Default: false' },
        },
      },
    },
    {
      name: 'execute_calendar_entry',
      description:
        'Execute a specific entry from a content calendar — generates the content and publishes or schedules it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          calendar_id: { type: 'string', description: 'The calendar ID' },
          entry_index: { type: 'number', description: 'The index of the entry to execute (0-based)' },
        },
        required: ['calendar_id', 'entry_index'],
      },
    },

    // ── Campaigns ─────────────────────────────────────────────────────
    {
      name: 'create_campaign',
      description:
        'Create a new marketing campaign. Campaigns group posts together for tracking performance as a cohesive marketing effort.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Campaign name (e.g., "March VoiceFly Launch")' },
          description: { type: 'string', description: 'Campaign description/goal' },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ALL_PLATFORMS },
            description: 'Target platforms for this campaign',
          },
          start_date: { type: 'string', description: 'Campaign start date (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'Campaign end date (YYYY-MM-DD)' },
        },
        required: ['name', 'platforms'],
      },
    },
    {
      name: 'list_campaigns',
      description: 'List marketing campaigns. Filter by status.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'paused', 'completed', 'draft'],
            description: 'Filter by status',
          },
          limit: { type: 'number', description: 'Max results. Default: 20' },
        },
      },
    },
    {
      name: 'get_campaign',
      description: 'Get details of a specific campaign including its posts.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          campaign_id: { type: 'string', description: 'Campaign ID' },
        },
        required: ['campaign_id'],
      },
    },
    {
      name: 'update_campaign',
      description: 'Update a campaign\'s details or status (pause, complete, etc).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          campaign_id: { type: 'string', description: 'Campaign ID' },
          name: { type: 'string', description: 'New name' },
          description: { type: 'string', description: 'New description' },
          status: {
            type: 'string',
            enum: ['active', 'paused', 'completed', 'draft'],
            description: 'New status',
          },
          end_date: { type: 'string', description: 'New end date' },
        },
        required: ['campaign_id'],
      },
    },
    {
      name: 'add_post_to_campaign',
      description: 'Associate an existing post with a campaign for tracking.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          campaign_id: { type: 'string', description: 'Campaign ID' },
          post_id: { type: 'string', description: 'Post ID to add' },
        },
        required: ['campaign_id', 'post_id'],
      },
    },
    {
      name: 'get_campaign_metrics',
      description: 'Get aggregated performance metrics for a campaign — total posts, impressions, engagements, clicks, and engagement rate.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          campaign_id: { type: 'string', description: 'Campaign ID' },
        },
        required: ['campaign_id'],
      },
    },

    // ── Autopilot ─────────────────────────────────────────────────────
    {
      name: 'run_autopilot',
      description:
        'Run the marketing autopilot cycle NOW. Checks content calendar, repurposes top posts, fills gaps with smart content, and generates insights. This is the "brain" that runs your marketing.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'get_autopilot_config',
      description: 'Get the current autopilot configuration — platforms, content mix, products, quiet hours, etc.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'configure_autopilot',
      description:
        'Configure the marketing autopilot — enable/disable, set platforms, content mix, products to promote, posting limits, and more.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          enabled: { type: 'boolean', description: 'Enable or disable the autopilot' },
          platforms: { type: 'array', items: { type: 'string', enum: ALL_PLATFORMS }, description: 'Active platforms' },
          auto_publish: { type: 'boolean', description: 'Actually publish (true) or just draft (false). Default: false for safety.' },
          max_posts_per_day: { type: 'number', description: 'Max posts per day. Default: 2' },
          default_tone: { type: 'string', description: 'Default content tone' },
          content_mix: {
            type: 'object',
            description: 'Content mix percentages. Must add up to 100.',
            properties: {
              educational: { type: 'number' },
              entertaining: { type: 'number' },
              inspirational: { type: 'number' },
              promotional: { type: 'number' },
              behindTheScenes: { type: 'number' },
            },
          },
          products: {
            type: 'array',
            description: 'Products the autopilot should promote',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Product name (e.g., "VoiceFly")' },
                description: { type: 'string', description: 'What it does' },
                targetAudience: { type: 'string', description: 'Who it\'s for' },
                keyFeatures: { type: 'array', items: { type: 'string' }, description: 'Key selling points' },
                hashtags: { type: 'array', items: { type: 'string' }, description: 'Product hashtags' },
                weight: { type: 'number', description: 'Promotion weight 0-1 (higher = more often)' },
              },
              required: ['name', 'description', 'targetAudience', 'keyFeatures', 'weight'],
            },
          },
          quiet_hours_start: { type: 'number', description: 'Hour (UTC) to stop posting' },
          quiet_hours_end: { type: 'number', description: 'Hour (UTC) to resume posting' },
          brand_id: { type: 'string', description: 'Brand profile ID' },
        },
      },
    },
    {
      name: 'generate_weekly_digest',
      description:
        'Generate a weekly marketing performance digest — metrics, top posts, AI-powered recommendations, and content suggestions for next week.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          brand_id: { type: 'string', description: 'Brand profile ID' },
        },
      },
    },

    // ── Brand Assets & Media Library ──────────────────────────────────
    {
      name: 'add_asset',
      description:
        'Add a brand asset to the media library — images, logos, videos, screenshots, graphics. These are used by the autopilot and content generation.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Asset name' },
          url: { type: 'string', description: 'Public URL to the asset (image, video, etc)' },
          type: { type: 'string', enum: ['image', 'video', 'logo', 'graphic', 'screenshot', 'template'], description: 'Asset type' },
          category: { type: 'string', enum: ['brand', 'product', 'lifestyle', 'testimonial', 'event', 'general'], description: 'Asset category' },
          description: { type: 'string', description: 'What this asset shows' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags for searchability' },
          product_name: { type: 'string', description: 'Which product this is for (e.g., "VoiceFly")' },
          platforms: { type: 'array', items: { type: 'string', enum: ALL_PLATFORMS }, description: 'Best platforms for this asset' },
          aspect_ratio: { type: 'string', description: 'Aspect ratio (e.g., "1:1", "4:5", "9:16")' },
        },
        required: ['name', 'url', 'type', 'category'],
      },
    },
    {
      name: 'list_assets',
      description: 'List brand assets. Filter by type, category, product, platform, or tags.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          type: { type: 'string', enum: ['image', 'video', 'logo', 'graphic', 'screenshot', 'template'] },
          category: { type: 'string', enum: ['brand', 'product', 'lifestyle', 'testimonial', 'event', 'general'] },
          product_name: { type: 'string', description: 'Filter by product' },
          platform: { type: 'string', enum: ALL_PLATFORMS },
          tags: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number', description: 'Max results. Default: 50' },
        },
      },
    },
    {
      name: 'delete_asset',
      description: 'Delete a brand asset by ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          asset_id: { type: 'string', description: 'Asset ID to delete' },
        },
        required: ['asset_id'],
      },
    },
    {
      name: 'create_content_template',
      description:
        'Create a reusable content template with {{variables}}. Use for recurring post formats like "Feature Friday" or "Customer Spotlight".',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Template name (e.g., "Feature Friday")' },
          platform: { type: 'string', enum: ALL_PLATFORMS, description: 'Target platform' },
          content_type: { type: 'string', enum: ['text', 'image_caption', 'video_script'] },
          template: { type: 'string', description: 'Template text with {{variable}} placeholders. E.g., "Did you know {{product}} can {{feature}}? {{benefit}}"' },
          description: { type: 'string', description: 'What this template is for' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'platform', 'content_type', 'template'],
      },
    },
    {
      name: 'list_content_templates',
      description: 'List reusable content templates. Filter by platform.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          platform: { type: 'string', enum: ALL_PLATFORMS },
          limit: { type: 'number', description: 'Max results. Default: 20' },
        },
      },
    },
    {
      name: 'apply_content_template',
      description: 'Fill in a content template with actual values and get the final text.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          template_id: { type: 'string', description: 'Template ID' },
          variables: { type: 'object', description: 'Key-value pairs to fill in. E.g., {"product": "VoiceFly", "feature": "answer calls 24/7"}' },
        },
        required: ['template_id', 'variables'],
      },
    },
    {
      name: 'save_brand_kit',
      description: 'Save your brand kit — logos, colors, fonts, and image style. Used by the autopilot to keep all content on-brand.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Brand name' },
          logos: {
            type: 'object',
            properties: {
              primary: { type: 'string', description: 'Primary logo URL' },
              secondary: { type: 'string', description: 'Secondary logo URL' },
              icon: { type: 'string', description: 'Icon/favicon URL' },
            },
          },
          colors: {
            type: 'object',
            properties: {
              primary: { type: 'string', description: 'Primary brand color (hex)' },
              secondary: { type: 'string', description: 'Secondary color (hex)' },
              accent: { type: 'string', description: 'Accent color (hex)' },
              background: { type: 'string', description: 'Background color (hex)' },
            },
            required: ['primary', 'secondary', 'accent', 'background'],
          },
          fonts: {
            type: 'object',
            properties: {
              heading: { type: 'string' },
              body: { type: 'string' },
            },
          },
          image_style: { type: 'string', description: 'Describe your visual style (e.g., "modern minimalist", "vibrant and bold")' },
        },
        required: ['name', 'colors'],
      },
    },
    {
      name: 'get_brand_kit',
      description: 'Get your saved brand kit — logos, colors, fonts, and image style.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },

    // ── Smart Image Router ────────────────────────────────────────────
    {
      name: 'smart_generate_image',
      description:
        'Smart image generation — automatically routes to the best AI provider (FAL.ai Flux or Nano Banana/Gemini) based on what the image needs. Use Nano Banana for text overlays, product shots, and marketing graphics. Use FAL for artistic/stylized images. Set to "auto" to let the router decide.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          prompt: { type: 'string', description: 'Image description' },
          aspect_ratio: { type: 'string', enum: ['1:1', '4:5', '9:16', '16:9'], description: 'Aspect ratio. Default: "1:1"' },
          needs_text_overlay: { type: 'boolean', description: 'Does the image need text rendered in it? (Nano Banana excels)' },
          needs_high_res: { type: 'boolean', description: 'Need 4K output? (Nano Banana supports)' },
          needs_consistency: { type: 'boolean', description: 'Need character/object consistency across images?' },
          preferred_provider: { type: 'string', enum: ['auto', 'fal', 'nanobanana'], description: 'Force a specific provider. Default: "auto"' },
          enhance_prompt: { type: 'boolean', description: 'Auto-enhance prompt with AI. Default: true' },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'smart_edit_image',
      description:
        'Edit an existing image using natural language (powered by Nano Banana/Gemini). "Remove the background", "Change the text to say X", "Make it more vibrant", "Add a person on the left".',
      inputSchema: {
        type: 'object' as const,
        properties: {
          image_url: { type: 'string', description: 'URL of the image to edit' },
          edit_prompt: { type: 'string', description: 'What to change (e.g., "Remove the background and add a gradient")' },
        },
        required: ['image_url', 'edit_prompt'],
      },
    },
    {
      name: 'explain_image_routing',
      description:
        'Explain which image provider would be chosen for a given prompt and why. Useful for understanding the smart routing decisions.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          prompt: { type: 'string', description: 'The image prompt to evaluate' },
          needs_text_overlay: { type: 'boolean' },
          needs_editing: { type: 'boolean' },
          needs_high_res: { type: 'boolean' },
          needs_consistency: { type: 'boolean' },
        },
        required: ['prompt'],
      },
    },
  ],
}))

// ============================================================================
// Tool Handlers
// ============================================================================

// Default user ID for the owner's account (DropFly)
const DEFAULT_USER_ID = process.env.SOCIALFLY_USER_ID || ''

async function getUserId(): Promise<string> {
  if (DEFAULT_USER_ID) return DEFAULT_USER_ID

  // Look up first user in the database as fallback
  const { getSupabase } = await import('../src/lib/engine/config.js')
  const supabase = getSupabase()
  const { data } = await supabase.from('profiles').select('id').limit(1).single()
  return data?.id || ''
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params

  try {
    switch (name) {
      // ── Content Generation & Publishing ─────────────────────────────

      case 'generate_and_publish': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured. Set SOCIALFLY_USER_ID env var.' }] }
        }

        const result = await generateAndPublish({
          topic: args.topic as string,
          platforms: (args.platforms as Platform[]) || ['instagram'],
          userId,
          includeImage: args.include_image !== false,
          imagePrompt: args.image_prompt as string | undefined,
          imageAspectRatio: (args.image_aspect_ratio || '1:1') as '1:1' | '4:5' | '9:16' | '16:9',
          tone: args.tone as string | undefined,
          brandId: args.brand_id as string | undefined,
          scheduleFor: args.schedule_for as string | undefined,
        })

        // If campaign_id provided, add the post to the campaign
        if (args.campaign_id && (result.scheduledPost?.id || result.publishResult?.contentId)) {
          const postId = result.scheduledPost?.id || result.publishResult?.contentId
          if (postId) {
            await addPostToCampaign(userId, args.campaign_id as string, postId)
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              error: result.error,
              content: {
                variants: result.content.variants,
                contentPillar: result.content.contentPillar,
              },
              image: result.image ? { url: result.image.url, enhancedPrompt: result.image.enhancedPrompt } : undefined,
              publish: result.publishResult ? {
                results: result.publishResult.results,
              } : undefined,
              scheduled: result.scheduledPost ? {
                id: result.scheduledPost.id,
                scheduledFor: result.scheduledPost.scheduledFor,
              } : undefined,
            }, null, 2),
          }],
        }
      }

      case 'generate_content': {
        const userId = await getUserId()
        const result = await generateContent({
          topic: args.topic as string,
          platforms: (args.platforms as Platform[]) || ['instagram'],
          contentType: (args.content_type as 'text' | 'image_caption' | 'video_script' | 'thread') || 'text',
          tone: args.tone as string | undefined,
          brandId: args.brand_id as string | undefined,
          userId,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      case 'generate_image': {
        const result = await generateImage({
          prompt: args.prompt as string,
          aspectRatio: (args.aspect_ratio as '1:1' | '4:5' | '9:16' | '16:9') || '1:1',
          enhancePrompt: args.enhance_prompt !== false,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      case 'publish_post': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const result = await publish({
          text: args.text as string,
          platforms: args.platforms as Platform[],
          mediaUrls: args.media_urls as string[] | undefined,
          mediaType: args.media_type as 'image' | 'video' | 'carousel' | undefined,
          userId,
        })

        // If campaign_id provided, add the post
        if (args.campaign_id && result.contentId) {
          await addPostToCampaign(userId, args.campaign_id as string, result.contentId)
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      case 'schedule_post': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const result = await schedule({
          text: args.text as string,
          platforms: args.platforms as Platform[],
          scheduledFor: args.scheduled_for as string,
          mediaUrls: args.media_urls as string[] | undefined,
          mediaType: args.media_type as 'image' | 'video' | 'carousel' | undefined,
          userId,
        })

        if (args.campaign_id && result.id) {
          await addPostToCampaign(userId, args.campaign_id as string, result.id)
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      case 'list_scheduled_posts': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const posts = await listScheduled(userId, {
          limit: (args.limit as number) || 20,
          status: args.status as string | undefined,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify({ count: posts.length, posts }, null, 2) }],
        }
      }

      case 'cancel_scheduled_post': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        await cancelScheduled(userId, args.post_id as string)
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, cancelled: args.post_id }) }],
        }
      }

      case 'get_post_history': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const posts = await getPostHistory(userId, {
          status: args.status as string | undefined,
          platform: args.platform as string | undefined,
          limit: (args.limit as number) || 20,
          since: args.since as string | undefined,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify({ count: posts.length, posts }, null, 2) }],
        }
      }

      case 'enhance_image_prompt': {
        const enhanced = await enhanceImagePrompt(
          args.prompt as string,
          { platform: args.platform as Platform | undefined }
        )

        return {
          content: [{ type: 'text', text: JSON.stringify({ original: args.prompt, enhanced }, null, 2) }],
        }
      }

      // ── Analytics ───────────────────────────────────────────────────

      case 'get_analytics': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const analytics = await getAnalytics(userId, {
          platforms: args.platforms as Platform[] | undefined,
          since: args.since as string | undefined,
          until: args.until as string | undefined,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify({ platforms: analytics }, null, 2) }],
        }
      }

      case 'get_performance_summary': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const summary = await getPerformanceSummary(userId, (args.days as number) || 30)

        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        }
      }

      // ── Content Calendar ────────────────────────────────────────────

      case 'generate_content_calendar': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const today = new Date().toISOString().split('T')[0]
        const calendar = await generateContentCalendar({
          userId,
          platforms: (args.platforms as Platform[]) || ['instagram'],
          startDate: (args.start_date as string) || today,
          days: (args.days as number) || 7,
          postsPerDay: (args.posts_per_day as number) || 1,
          themes: args.themes as string[] | undefined,
          brandId: args.brand_id as string | undefined,
          tone: args.tone as string | undefined,
          campaignId: args.campaign_id as string | undefined,
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: calendar.id,
              startDate: calendar.startDate,
              endDate: calendar.endDate,
              totalEntries: calendar.entries.length,
              platforms: calendar.platforms,
              themes: calendar.themes,
              entries: calendar.entries,
            }, null, 2),
          }],
        }
      }

      case 'get_content_calendars': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const calendars = await getContentCalendars(userId, {
          limit: (args.limit as number) || 10,
          active: (args.active_only as boolean) || false,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify({ count: calendars.length, calendars }, null, 2) }],
        }
      }

      case 'execute_calendar_entry': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const result = await executeCalendarEntry(
          userId,
          args.calendar_id as string,
          args.entry_index as number
        )

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      // ── Campaigns ───────────────────────────────────────────────────

      case 'create_campaign': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const campaign = await createCampaign({
          userId,
          name: args.name as string,
          description: args.description as string | undefined,
          platforms: (args.platforms as Platform[]) || ['instagram'],
          startDate: args.start_date as string | undefined,
          endDate: args.end_date as string | undefined,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(campaign, null, 2) }],
        }
      }

      case 'list_campaigns': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const campaigns = await listCampaigns(userId, {
          status: args.status as string | undefined,
          limit: (args.limit as number) || 20,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify({ count: campaigns.length, campaigns }, null, 2) }],
        }
      }

      case 'get_campaign': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const campaign = await getCampaign(userId, args.campaign_id as string)

        return {
          content: [{ type: 'text', text: JSON.stringify(campaign, null, 2) }],
        }
      }

      case 'update_campaign': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const campaign = await updateCampaign(userId, args.campaign_id as string, {
          name: args.name as string | undefined,
          description: args.description as string | undefined,
          status: args.status as 'active' | 'paused' | 'completed' | 'draft' | undefined,
          endDate: args.end_date as string | undefined,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(campaign, null, 2) }],
        }
      }

      case 'add_post_to_campaign': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        await addPostToCampaign(userId, args.campaign_id as string, args.post_id as string)
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, campaignId: args.campaign_id, postId: args.post_id }) }],
        }
      }

      case 'get_campaign_metrics': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const metrics = await getCampaignMetrics(userId, args.campaign_id as string)
        return {
          content: [{ type: 'text', text: JSON.stringify(metrics, null, 2) }],
        }
      }

      // ── Autopilot ─────────────────────────────────────────────────

      case 'run_autopilot': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const config = await getAutopilotConfig(userId)
        const runResult = await runAutopilot(config)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              timestamp: runResult.timestamp,
              postsCreated: runResult.postsCreated,
              postsScheduled: runResult.postsScheduled,
              repurposed: runResult.repurposed,
              skipped: runResult.skipped,
              actions: runResult.actions,
              insights: runResult.insights,
              errors: runResult.errors,
            }, null, 2),
          }],
        }
      }

      case 'get_autopilot_config': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const config = await getAutopilotConfig(userId)
        return {
          content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
        }
      }

      case 'configure_autopilot': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        // Get existing config and merge updates
        const existing = await getAutopilotConfig(userId)
        const updated = { ...existing }
        if (args.enabled !== undefined) updated.enabled = args.enabled as boolean
        if (args.platforms) updated.platforms = args.platforms as Platform[]
        if (args.auto_publish !== undefined) updated.autoPublish = args.auto_publish as boolean
        if (args.max_posts_per_day) updated.maxPostsPerDay = args.max_posts_per_day as number
        if (args.default_tone) updated.defaultTone = args.default_tone as string
        if (args.content_mix) updated.contentMix = args.content_mix as typeof existing.contentMix
        if (args.products) updated.products = args.products as typeof existing.products
        if (args.quiet_hours_start !== undefined) updated.quietHoursStart = args.quiet_hours_start as number
        if (args.quiet_hours_end !== undefined) updated.quietHoursEnd = args.quiet_hours_end as number
        if (args.brand_id) updated.brandId = args.brand_id as string

        await saveAutopilotConfig(updated)

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, config: updated }, null, 2) }],
        }
      }

      case 'generate_weekly_digest': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const digest = await generateWeeklyDigest(userId, args.brand_id as string | undefined)
        return {
          content: [{ type: 'text', text: JSON.stringify(digest, null, 2) }],
        }
      }

      // ── Brand Assets ────────────────────────────────────────────────

      case 'add_asset': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const asset = await addAsset({
          userId,
          name: args.name as string,
          url: args.url as string,
          type: args.type as 'image' | 'video' | 'logo' | 'graphic' | 'screenshot' | 'template',
          category: args.category as 'brand' | 'product' | 'lifestyle' | 'testimonial' | 'event' | 'general',
          description: args.description as string | undefined,
          tags: args.tags as string[] | undefined,
          productName: args.product_name as string | undefined,
          platforms: args.platforms as Platform[] | undefined,
          aspectRatio: args.aspect_ratio as string | undefined,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(asset, null, 2) }],
        }
      }

      case 'list_assets': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const assets = await listAssets(userId, {
          type: args.type as 'image' | 'video' | 'logo' | 'graphic' | 'screenshot' | 'template' | undefined,
          category: args.category as 'brand' | 'product' | 'lifestyle' | 'testimonial' | 'event' | 'general' | undefined,
          productName: args.product_name as string | undefined,
          platform: args.platform as Platform | undefined,
          tags: args.tags as string[] | undefined,
          limit: (args.limit as number) || 50,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify({ count: assets.length, assets }, null, 2) }],
        }
      }

      case 'delete_asset': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        await deleteAsset(userId, args.asset_id as string)
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, deleted: args.asset_id }) }],
        }
      }

      case 'create_content_template': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const template = await createTemplate({
          userId,
          name: args.name as string,
          platform: args.platform as Platform,
          contentType: args.content_type as 'text' | 'image_caption' | 'video_script',
          template: args.template as string,
          description: args.description as string | undefined,
          tags: args.tags as string[] | undefined,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(template, null, 2) }],
        }
      }

      case 'list_content_templates': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const templates = await listTemplates(userId, {
          platform: args.platform as Platform | undefined,
          limit: (args.limit as number) || 20,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify({ count: templates.length, templates }, null, 2) }],
        }
      }

      case 'apply_content_template': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const text = await applyTemplate(
          userId,
          args.template_id as string,
          args.variables as Record<string, string>
        )

        return {
          content: [{ type: 'text', text: JSON.stringify({ text }, null, 2) }],
        }
      }

      case 'save_brand_kit': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const kit = await saveBrandKit(userId, {
          name: args.name as string,
          logos: (args.logos || {}) as { primary?: string; secondary?: string; icon?: string },
          colors: args.colors as { primary: string; secondary: string; accent: string; background: string },
          fonts: args.fonts as { heading: string; body: string } | undefined,
          imageStyle: args.image_style as string | undefined,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(kit, null, 2) }],
        }
      }

      case 'get_brand_kit': {
        const userId = await getUserId()
        if (!userId) {
          return { content: [{ type: 'text', text: 'Error: No user ID configured.' }] }
        }

        const kit = await getBrandKit(userId)
        return {
          content: [{ type: 'text', text: kit ? JSON.stringify(kit, null, 2) : 'No brand kit configured yet.' }],
        }
      }

      // ── Smart Image Router ──────────────────────────────────────────

      case 'smart_generate_image': {
        const enhanceFirst = args.enhance_prompt !== false
        let finalPrompt = args.prompt as string

        // Optionally enhance prompt
        if (enhanceFirst) {
          finalPrompt = await enhanceImagePrompt(finalPrompt)
        }

        const result = await smartGenerateImage({
          prompt: finalPrompt,
          aspectRatio: (args.aspect_ratio as '1:1' | '4:5' | '9:16' | '16:9') || '1:1',
          needsTextOverlay: args.needs_text_overlay as boolean | undefined,
          needsHighRes: args.needs_high_res as boolean | undefined,
          needsConsistency: args.needs_consistency as boolean | undefined,
          preferredProvider: (args.preferred_provider || 'auto') as ImageProvider,
          enhancePrompt: false, // Already enhanced above
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              url: result.url,
              provider: result.provider,
              prompt: result.prompt,
              enhancedPrompt: enhanceFirst ? finalPrompt : undefined,
              routing: result.routingScore,
            }, null, 2),
          }],
        }
      }

      case 'smart_edit_image': {
        const editResult = await smartEditImage(
          args.image_url as string,
          args.edit_prompt as string
        )

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              url: editResult.url,
              provider: editResult.provider,
              editPrompt: args.edit_prompt,
            }, null, 2),
          }],
        }
      }

      case 'explain_image_routing': {
        const explanation = explainRouting(args.prompt as string, {
          needsTextOverlay: args.needs_text_overlay as boolean | undefined,
          needsEditing: args.needs_editing as boolean | undefined,
          needsHighRes: args.needs_high_res as boolean | undefined,
          needsConsistency: args.needs_consistency as boolean | undefined,
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              winner: explanation.winner,
              scores: explanation.scores.map(s => ({
                provider: s.provider,
                score: s.score,
                reasons: s.reasons,
              })),
            }, null, 2),
          }],
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    }
  }
})

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[socialfly-mcp] Server v3.1.0 running — 38 tools across 9 categories')
}

main().catch((error) => {
  console.error('[socialfly-mcp] Fatal error:', error)
  process.exit(1)
})
