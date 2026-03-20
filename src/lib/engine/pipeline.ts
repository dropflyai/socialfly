/**
 * SocialFly Pipeline
 *
 * The power function: topic → AI content → AI image → publish/schedule
 * Single call does everything.
 */

import { generateContent, generateImage } from './generate'
import { publish, schedule } from './publish'
import { loadBrandVoice } from './brand'
import type {
  GenerateAndPublishOptions,
  FullPublishResult,
  GeneratedContent,
  GeneratedImage,
  Platform,
  PostRecord,
} from './types'

export interface PipelineResult {
  success: boolean
  content: GeneratedContent
  image?: GeneratedImage
  publishResult?: FullPublishResult
  scheduledPost?: PostRecord
  error?: string
}

/**
 * Generate content and optionally an image, then publish or schedule.
 *
 * This is the main entry point for AI agents. One call does everything:
 * 1. Generates platform-specific captions with Claude
 * 2. Optionally generates an AI image with FAL.ai
 * 3. Publishes immediately or schedules for later
 *
 * @example
 * // Immediate publish with AI image
 * await generateAndPublish({
 *   topic: "How AI is transforming small business phone systems",
 *   platforms: ['instagram'],
 *   userId: 'user-id',
 *   includeImage: true,
 * })
 *
 * @example
 * // Schedule for later, custom image prompt
 * await generateAndPublish({
 *   topic: "Introducing TaxFly - AI tax preparation",
 *   platforms: ['instagram', 'twitter'],
 *   userId: 'user-id',
 *   includeImage: true,
 *   imagePrompt: "futuristic tax documents floating in digital space",
 *   scheduleFor: '2026-03-20T09:00:00Z',
 * })
 */
export async function generateAndPublish(
  options: GenerateAndPublishOptions
): Promise<PipelineResult> {
  const {
    topic,
    platforms,
    userId,
    includeImage = false,
    imagePrompt,
    imageAspectRatio = '1:1',
    brandId,
    tone,
    scheduleFor,
  } = options

  try {
    // Step 1: Generate content
    const content = await generateContent({
      topic,
      platforms,
      contentType: includeImage ? 'image_caption' : 'text',
      brandId,
      userId,
      tone,
    })

    // Step 2: Generate image if requested
    let image: GeneratedImage | undefined
    if (includeImage) {
      // Use explicit image prompt, or derive from content's suggested_media
      const primaryPlatform = platforms[0]
      const variant = content.variants[primaryPlatform]
      const baseImagePrompt = imagePrompt
        || variant?.suggestedMedia
        || `Professional social media image for: ${topic}`

      // Load brand for image style context
      let brand = undefined
      if (userId) {
        brand = await loadBrandVoice(userId, brandId) || undefined
      }

      image = await generateImage({
        prompt: baseImagePrompt,
        aspectRatio: imageAspectRatio,
        enhancePrompt: true,
      })
    }

    // Step 3: Get the text for the primary platform
    const primaryPlatform = platforms[0]
    const variant = content.variants[primaryPlatform]
    if (!variant) {
      throw new Error(`No content generated for platform: ${primaryPlatform}`)
    }

    // Build the final text with hashtags
    let finalText = variant.text
    if (variant.hashtags?.length) {
      // Check if hashtags are already in the text
      const hasHashtags = variant.hashtags.some((tag: string) => finalText.includes(tag))
      if (!hasHashtags) {
        finalText += '\n\n' + variant.hashtags.join(' ')
      }
    }

    // Step 4: Publish or schedule
    const mediaUrls = image ? [image.url] : undefined
    const mediaType = image ? 'image' as const : undefined

    if (scheduleFor) {
      const scheduledPost = await schedule({
        text: finalText,
        platforms,
        mediaUrls,
        mediaType,
        userId,
        contentId: content.id,
        scheduledFor: scheduleFor,
      })

      return {
        success: true,
        content,
        image,
        scheduledPost,
      }
    }

    const publishResult = await publish({
      text: finalText,
      platforms,
      mediaUrls,
      mediaType,
      userId,
      contentId: content.id,
    })

    return {
      success: publishResult.success,
      content,
      image,
      publishResult,
    }
  } catch (error) {
    return {
      success: false,
      content: { variants: {}, contentPillar: '', engagementHooks: [], tokensUsed: 0 },
      error: error instanceof Error ? error.message : 'Pipeline failed',
    }
  }
}

/**
 * Generate content only (no publish). Useful for preview/approval workflows.
 */
export async function generatePreview(
  options: Omit<GenerateAndPublishOptions, 'userId' | 'scheduleFor'> & { userId?: string }
): Promise<{ content: GeneratedContent; image?: GeneratedImage }> {
  const { topic, platforms, includeImage, imagePrompt, imageAspectRatio = '1:1', brandId, tone, userId } = options

  const content = await generateContent({
    topic,
    platforms,
    contentType: includeImage ? 'image_caption' : 'text',
    brandId,
    userId,
    tone,
  })

  let image: GeneratedImage | undefined
  if (includeImage) {
    const primaryVariant = content.variants[platforms[0]]
    const basePrompt = imagePrompt || primaryVariant?.suggestedMedia || topic

    image = await generateImage({
      prompt: basePrompt,
      aspectRatio: imageAspectRatio,
      enhancePrompt: true,
    })
  }

  return { content, image }
}
