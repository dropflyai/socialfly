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
 *       "INSTAGRAM_ACCOUNT_ID": "..."
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
  type Platform,
} from '../src/lib/engine/index.js'

// Initialize the engine from env vars
initEngine()

const server = new Server(
  { name: 'socialfly', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// ============================================================================
// Tool Definitions
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'generate_and_publish',
      description:
        'Generate AI content and optionally an AI image, then publish or schedule to social media. This is the main power tool - one call does everything: AI caption + AI image + publish to Instagram.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description: 'The topic or prompt for the post (e.g., "How AI is transforming small business phone systems")',
          },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['instagram', 'twitter', 'tiktok'] },
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
        },
        required: ['topic'],
      },
    },
    {
      name: 'generate_content',
      description:
        'Generate AI social media captions/text without publishing. Returns platform-specific variants with hashtags and posting time suggestions.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description: 'The topic or prompt for content generation',
          },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['instagram', 'twitter', 'tiktok', 'linkedin', 'facebook'] },
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
        'Publish pre-written content to social media platforms. Use this when you already have the text and optional media URL.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          text: { type: 'string', description: 'The post text/caption' },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['instagram', 'twitter', 'tiktok'] },
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
            items: { type: 'string', enum: ['instagram', 'twitter', 'tiktok'] },
          },
          scheduled_for: {
            type: 'string',
            description: 'ISO timestamp for when to publish (e.g., "2026-03-20T09:00:00Z")',
          },
          media_urls: { type: 'array', items: { type: 'string' } },
          media_type: { type: 'string', enum: ['image', 'video', 'carousel'] },
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
            enum: ['instagram', 'twitter', 'tiktok'],
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
        'Take a simple image description and enhance it into a detailed, high-quality prompt for AI image generation. Useful for previewing what the image prompt will be.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          prompt: { type: 'string', description: 'Simple image description to enhance' },
          platform: { type: 'string', enum: ['instagram', 'twitter', 'tiktok'] },
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
          platforms: args.platforms as ('instagram' | 'twitter' | 'tiktok')[],
          mediaUrls: args.media_urls as string[] | undefined,
          mediaType: args.media_type as 'image' | 'video' | 'carousel' | undefined,
          userId,
        })

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
          platforms: args.platforms as ('instagram' | 'twitter' | 'tiktok')[],
          scheduledFor: args.scheduled_for as string,
          mediaUrls: args.media_urls as string[] | undefined,
          mediaType: args.media_type as 'image' | 'video' | 'carousel' | undefined,
          userId,
        })

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
          { platform: args.platform as 'instagram' | 'twitter' | 'tiktok' | undefined }
        )

        return {
          content: [{ type: 'text', text: JSON.stringify({ original: args.prompt, enhanced }, null, 2) }],
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
  console.error('[socialfly-mcp] Server running')
}

main().catch((error) => {
  console.error('[socialfly-mcp] Fatal error:', error)
  process.exit(1)
})
