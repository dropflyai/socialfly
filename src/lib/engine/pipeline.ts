/**
 * SocialFly Pipeline
 *
 * The power function: topic → AI content → AI image → publish/schedule
 * Single call does everything.
 */

import { generateContent, generateImage, enhanceImagePrompt } from './generate'
import { publish, schedule } from './publish'
import { loadBrandDNA, brandDNAToCapabilityBinding } from './brand'
import { generateBrandImage } from './capability-engine'
import { smartGenerateVideo } from './video-router'
import type {
  GenerateAndPublishOptions,
  FullPublishResult,
  GeneratedContent,
  GeneratedImage,
  GeneratedVideo,
  VideoProvider,
  Platform,
  PostRecord,
} from './types'

export interface PipelineResult {
  success: boolean
  content: GeneratedContent
  image?: GeneratedImage
  video?: GeneratedVideo
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
  options: GenerateAndPublishOptions & {
    includeVideo?: boolean
    videoPrompt?: string
    videoProvider?: VideoProvider
    videoFromImage?: boolean  // Generate image first, then animate it
  }
): Promise<PipelineResult> {
  const {
    topic,
    platforms,
    userId,
    includeImage = false,
    imagePrompt,
    imageAspectRatio = '1:1',
    includeVideo = false,
    videoPrompt,
    videoProvider = 'auto',
    videoFromImage = false,
    brandId,
    tone,
    scheduleFor,
  } = options

  try {
    // Step 1: Generate content
    const contentType = includeVideo ? 'video_script' : includeImage ? 'image_caption' : 'text'
    const content = await generateContent({
      topic,
      platforms,
      contentType,
      brandId,
      userId,
      tone,
    })

    // Step 2: Generate image if requested (or as starting frame for video)
    let image: GeneratedImage | undefined
    if (includeImage || (includeVideo && videoFromImage)) {
      const primaryPlatform = platforms[0]
      const variant = content.variants[primaryPlatform]
      const baseImagePrompt = imagePrompt
        || variant?.suggestedMedia
        || `Professional social media image for: ${topic}`

      const aspect = includeVideo ? '16:9' as const : imageAspectRatio

      // U3: load Brand DNA (the Soul ledger) and route image gen through the
      // capability engine so the four hf_* bindings (soul/brand_kit/style/elements)
      // are injected. When no brand_souls row exists AND Higgsfield is not the
      // opted-in media default, the engine resolves to the UNCHANGED legacy FAL
      // path — byte-identical to before (zero behavior change).
      const dna = userId ? await loadBrandDNA(userId).catch(() => null) : null
      const binding = brandDNAToCapabilityBinding(dna)

      // Preserve the prior prompt-enhancement behavior (Claude) before generation.
      const finalPrompt = await enhanceImagePrompt(baseImagePrompt).catch(() => baseImagePrompt)

      const capResult = await generateBrandImage({
        prompt: finalPrompt,
        aspectRatio: aspect,
        platform: primaryPlatform,
        userId,
        brandDNA: binding,
      })

      if (capResult.url) {
        image = { url: capResult.url, prompt: baseImagePrompt, enhancedPrompt: finalPrompt, meta: capResult.meta }
      } else {
        // Capability engine fail-soft with no media (e.g. queued / gate-skipped) —
        // fall back to the direct generator so the pipeline still produces an image.
        image = await generateImage({ prompt: baseImagePrompt, aspectRatio: aspect, enhancePrompt: true })
      }
    }

    // Step 3: Generate video if requested
    let video: GeneratedVideo | undefined
    if (includeVideo) {
      const primaryPlatform = platforms[0]
      const variant = content.variants[primaryPlatform]
      const baseVideoPrompt = videoPrompt
        || variant?.suggestedMedia
        || `Professional social media video for: ${topic}`

      video = await smartGenerateVideo({
        prompt: baseVideoPrompt,
        imageUrl: videoFromImage && image ? image.url : undefined,
        preferredProvider: videoProvider,
      })
    }

    // Step 4: Get the text for the primary platform
    const primaryPlatform = platforms[0]
    const variant = content.variants[primaryPlatform]
    if (!variant) {
      throw new Error(`No content generated for platform: ${primaryPlatform}`)
    }

    // Build the final text with hashtags
    let finalText = variant.text
    if (variant.hashtags?.length) {
      const hasHashtags = variant.hashtags.some((tag: string) => finalText.includes(tag))
      if (!hasHashtags) {
        finalText += '\n\n' + variant.hashtags.join(' ')
      }
    }

    // Step 5: Determine media for publishing
    const mediaUrls = video ? [video.url] : image ? [image.url] : undefined
    const mediaType = video ? 'video' as const : image ? 'image' as const : undefined

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
        video,
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
      video,
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
