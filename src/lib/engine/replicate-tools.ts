/**
 * Replicate Tools
 *
 * Utility functions for running open-source models on Replicate.
 * These are post-processing and enhancement tools, NOT replacements
 * for the primary image/video generation providers.
 *
 * Tools:
 * - removeBackground — Remove image backgrounds (rembg)
 * - upscaleImage — 2x/4x upscaling (Real-ESRGAN)
 * - styleTransfer — Apply artistic styles to images
 * - faceSwap — Swap faces for brand consistency
 * - generateWithCustomModel — Run any Replicate model
 */

import Replicate from 'replicate'
import { getConfig } from './config'
import { getSupabase } from './config'
import type { ReplicateToolResult } from './types'

// ============================================================================
// Client
// ============================================================================

function getReplicateClient(): Replicate {
  const config = getConfig()
  const token = config.replicateApiToken || process.env.REPLICATE_API_TOKEN

  if (!token) {
    throw new Error('REPLICATE_API_TOKEN not configured. Add it to your environment variables.')
  }

  return new Replicate({ auth: token })
}

// ============================================================================
// Supabase Upload Helper
// ============================================================================

const BUCKET_NAME = 'media-assets'

/**
 * Download a result from Replicate and upload it to Supabase storage.
 * Returns the public URL.
 */
async function uploadToSupabase(
  resultUrl: string,
  folder: string,
  fileExtension: string = 'png'
): Promise<string> {
  const supabase = getSupabase()

  // Download the processed image from Replicate
  const response = await fetch(resultUrl)
  if (!response.ok) {
    throw new Error(`Failed to download result from Replicate: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') || `image/${fileExtension}`
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExtension}`

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload to Supabase storage: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName)

  return urlData.publicUrl
}

/**
 * Extract the output URL from a Replicate result.
 * Replicate returns different shapes depending on the model.
 */
function extractOutputUrl(output: unknown): string {
  // String output (single URL)
  if (typeof output === 'string') {
    return output
  }

  // Array of strings (most common — list of output URLs)
  if (Array.isArray(output)) {
    const first = output[0]
    if (typeof first === 'string') return first
    // Array of objects with url property
    if (first && typeof first === 'object' && 'url' in first) {
      return (first as { url: string }).url
    }
  }

  // Object with url property
  if (output && typeof output === 'object' && 'url' in output) {
    return (output as { url: string }).url
  }

  // ReadableStream or FileOutput — convert to string
  if (output && typeof output === 'object' && 'toString' in output) {
    const str = output.toString()
    if (str.startsWith('http')) return str
  }

  throw new Error(`Unexpected Replicate output format: ${JSON.stringify(output).slice(0, 200)}`)
}

// ============================================================================
// Tool: Remove Background
// ============================================================================

/**
 * Remove the background from an image using rembg.
 *
 * @param imageUrl - URL of the image to process
 * @returns Public URL of the processed image with transparent background
 */
export async function removeBackground(imageUrl: string): Promise<ReplicateToolResult> {
  const replicate = getReplicateClient()

  try {
    const output = await replicate.run('cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003', {
      input: {
        image: imageUrl,
      },
    })

    const resultUrl = extractOutputUrl(output)
    const publicUrl = await uploadToSupabase(resultUrl, 'replicate/bg-removed', 'png')

    return {
      success: true,
      url: publicUrl,
      model: 'cjwbw/rembg',
      tool: 'remove_background',
    }
  } catch (error) {
    console.error('[Replicate] removeBackground error:', error)
    return {
      success: false,
      url: '',
      model: 'cjwbw/rembg',
      tool: 'remove_background',
      error: error instanceof Error ? error.message : 'Background removal failed',
    }
  }
}

// ============================================================================
// Tool: Upscale Image
// ============================================================================

/**
 * Upscale an image using Real-ESRGAN.
 *
 * @param imageUrl - URL of the image to upscale
 * @param scale - Upscale factor: 2 or 4 (default: 2)
 * @returns Public URL of the upscaled image
 */
export async function upscaleImage(
  imageUrl: string,
  scale: 2 | 4 = 2
): Promise<ReplicateToolResult> {
  const replicate = getReplicateClient()

  try {
    const output = await replicate.run('nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa', {
      input: {
        image: imageUrl,
        scale,
        face_enhance: false,
      },
    })

    const resultUrl = extractOutputUrl(output)
    const publicUrl = await uploadToSupabase(resultUrl, 'replicate/upscaled', 'png')

    return {
      success: true,
      url: publicUrl,
      model: 'nightmareai/real-esrgan',
      tool: 'upscale',
    }
  } catch (error) {
    console.error('[Replicate] upscaleImage error:', error)
    return {
      success: false,
      url: '',
      model: 'nightmareai/real-esrgan',
      tool: 'upscale',
      error: error instanceof Error ? error.message : 'Image upscaling failed',
    }
  }
}

// ============================================================================
// Tool: Style Transfer
// ============================================================================

/**
 * Apply artistic style transfer to an image.
 * Uses an img2img model with a style prompt.
 *
 * @param imageUrl - URL of the source image
 * @param stylePrompt - Description of the desired style (e.g. "oil painting", "watercolor")
 * @returns Public URL of the styled image
 */
export async function styleTransfer(
  imageUrl: string,
  stylePrompt: string
): Promise<ReplicateToolResult> {
  const replicate = getReplicateClient()

  try {
    const output = await replicate.run('timothybrooks/instruct-pix2pix:30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f', {
      input: {
        image: imageUrl,
        prompt: stylePrompt,
        num_inference_steps: 30,
        image_guidance_scale: 1.5,
        guidance_scale: 7.5,
      },
    })

    const resultUrl = extractOutputUrl(output)
    const publicUrl = await uploadToSupabase(resultUrl, 'replicate/styled', 'png')

    return {
      success: true,
      url: publicUrl,
      model: 'timothybrooks/instruct-pix2pix',
      tool: 'style_transfer',
    }
  } catch (error) {
    console.error('[Replicate] styleTransfer error:', error)
    return {
      success: false,
      url: '',
      model: 'timothybrooks/instruct-pix2pix',
      tool: 'style_transfer',
      error: error instanceof Error ? error.message : 'Style transfer failed',
    }
  }
}

// ============================================================================
// Tool: Face Swap
// ============================================================================

/**
 * Swap a face from one image onto another.
 * Useful for brand consistency — put your brand ambassador's face on different scenes.
 *
 * @param sourceUrl - URL of the image with the face to use
 * @param targetUrl - URL of the target image to swap the face onto
 * @returns Public URL of the result image
 */
export async function faceSwap(
  sourceUrl: string,
  targetUrl: string
): Promise<ReplicateToolResult> {
  const replicate = getReplicateClient()

  try {
    const output = await replicate.run('lucataco/faceswap:9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d', {
      input: {
        source_image: sourceUrl,
        target_image: targetUrl,
      },
    })

    const resultUrl = extractOutputUrl(output)
    const publicUrl = await uploadToSupabase(resultUrl, 'replicate/faceswap', 'png')

    return {
      success: true,
      url: publicUrl,
      model: 'lucataco/faceswap',
      tool: 'face_swap',
    }
  } catch (error) {
    console.error('[Replicate] faceSwap error:', error)
    return {
      success: false,
      url: '',
      model: 'lucataco/faceswap',
      tool: 'face_swap',
      error: error instanceof Error ? error.message : 'Face swap failed',
    }
  }
}

// ============================================================================
// Tool: Run Any Custom Model
// ============================================================================

/**
 * Run any Replicate model with custom inputs.
 * This is the generic escape hatch for accessing thousands of open-source models.
 *
 * @param modelId - Full model identifier (e.g. "owner/model:version" or "owner/model")
 * @param inputs - Model-specific input parameters
 * @returns Public URL of the output (assumes image output — adjust for other types)
 */
export async function generateWithCustomModel(
  modelId: string,
  inputs: Record<string, unknown>
): Promise<ReplicateToolResult> {
  const replicate = getReplicateClient()

  try {
    const output = await replicate.run(modelId as `${string}/${string}:${string}`, {
      input: inputs,
    })

    const resultUrl = extractOutputUrl(output)
    const publicUrl = await uploadToSupabase(resultUrl, 'replicate/custom', 'png')

    return {
      success: true,
      url: publicUrl,
      model: modelId,
      tool: 'custom',
    }
  } catch (error) {
    console.error(`[Replicate] generateWithCustomModel (${modelId}) error:`, error)
    return {
      success: false,
      url: '',
      model: modelId,
      tool: 'custom',
      error: error instanceof Error ? error.message : `Custom model ${modelId} failed`,
    }
  }
}

// ============================================================================
// Available Tools Metadata
// ============================================================================

export function getAvailableReplicateTools() {
  return [
    {
      id: 'remove_background',
      name: 'Remove Background',
      description: 'Remove image background using AI. Returns a transparent PNG.',
      model: 'cjwbw/rembg',
      creditCost: 3,
    },
    {
      id: 'upscale',
      name: 'Upscale Image',
      description: 'Upscale images 2x or 4x using Real-ESRGAN. Great for making social media images crisp.',
      model: 'nightmareai/real-esrgan',
      creditCost: 3,
    },
    {
      id: 'style_transfer',
      name: 'Style Transfer',
      description: 'Apply artistic styles to existing images. Transform photos into paintings, sketches, etc.',
      model: 'timothybrooks/instruct-pix2pix',
      creditCost: 5,
    },
    {
      id: 'face_swap',
      name: 'Face Swap',
      description: 'Swap faces between images for brand consistency across different scenes.',
      model: 'lucataco/faceswap',
      creditCost: 5,
    },
    {
      id: 'custom',
      name: 'Custom Model',
      description: 'Run any model from the Replicate model registry.',
      model: 'user-specified',
      creditCost: 5,
    },
  ]
}
