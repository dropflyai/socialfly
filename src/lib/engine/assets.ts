/**
 * Brand Asset Manager
 *
 * Manages your library of images, logos, videos, and content templates.
 * This is how you provide raw materials for the autopilot to use
 * when generating and publishing content.
 *
 * Asset sources:
 * 1. Direct upload (URL to Supabase Storage)
 * 2. Brand kit (logos, colors, fonts)
 * 3. Content templates (reusable post formats)
 * 4. Media library (photos, videos, graphics)
 * 5. Product assets (screenshots, demos, feature images)
 */

import { getSupabase } from './config'
import type { Platform } from './types'

// ============================================================================
// Types
// ============================================================================

export type AssetType = 'image' | 'video' | 'logo' | 'graphic' | 'screenshot' | 'template'
export type AssetCategory = 'brand' | 'product' | 'lifestyle' | 'testimonial' | 'event' | 'general'

export interface BrandAsset {
  id: string
  userId: string
  type: AssetType
  category: AssetCategory
  name: string
  description?: string
  url: string                    // Public URL (Supabase Storage or external)
  thumbnailUrl?: string
  mimeType: string
  fileSize?: number
  dimensions?: { width: number; height: number }
  tags: string[]
  productName?: string           // Which product this is for (e.g., "VoiceFly")
  platforms?: Platform[]         // Best platforms for this asset
  aspectRatio?: string           // "1:1", "4:5", "9:16", "16:9"
  usageCount: number
  lastUsedAt?: string
  createdAt: string
}

export interface ContentTemplate {
  id: string
  userId: string
  name: string
  description?: string
  platform: Platform
  contentType: 'text' | 'image_caption' | 'video_script'
  template: string               // Template with {{variables}}
  variables: string[]            // e.g., ["product_name", "feature", "benefit"]
  tags: string[]
  usageCount: number
  createdAt: string
}

export interface BrandKit {
  id: string
  userId: string
  name: string
  logos: { primary?: string; secondary?: string; icon?: string }
  colors: { primary: string; secondary: string; accent: string; background: string }
  fonts?: { heading: string; body: string }
  imageStyle?: string            // "modern minimalist", "vibrant and bold", etc.
  createdAt: string
}

// ============================================================================
// Asset Management
// ============================================================================

/**
 * Add a brand asset (image, video, logo, etc).
 */
export async function addAsset(
  options: {
    userId: string
    type: AssetType
    category: AssetCategory
    name: string
    url: string
    description?: string
    mimeType?: string
    tags?: string[]
    productName?: string
    platforms?: Platform[]
    aspectRatio?: string
  }
): Promise<BrandAsset> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('brand_assets')
    .insert({
      user_id: options.userId,
      type: options.type,
      category: options.category,
      name: options.name,
      url: options.url,
      description: options.description || null,
      mime_type: options.mimeType || inferMimeType(options.url),
      tags: options.tags || [],
      product_name: options.productName || null,
      platforms: options.platforms || null,
      aspect_ratio: options.aspectRatio || null,
      usage_count: 0,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to add asset: ${error.message}`)
  return mapAssetRecord(data)
}

/**
 * List brand assets with optional filters.
 */
export async function listAssets(
  userId: string,
  options?: {
    type?: AssetType
    category?: AssetCategory
    productName?: string
    platform?: Platform
    tags?: string[]
    limit?: number
  }
): Promise<BrandAsset[]> {
  const supabase = getSupabase()

  let query = supabase
    .from('brand_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50)

  if (options?.type) query = query.eq('type', options.type)
  if (options?.category) query = query.eq('category', options.category)
  if (options?.productName) query = query.eq('product_name', options.productName)
  if (options?.platform) query = query.contains('platforms', [options.platform])
  if (options?.tags?.length) query = query.overlaps('tags', options.tags)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list assets: ${error.message}`)
  return (data || []).map(mapAssetRecord)
}

/**
 * Get a specific asset by ID.
 */
export async function getAsset(userId: string, assetId: string): Promise<BrandAsset> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('brand_assets')
    .select('*')
    .eq('id', assetId)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`Asset not found: ${error.message}`)
  return mapAssetRecord(data)
}

/**
 * Delete an asset.
 */
export async function deleteAsset(userId: string, assetId: string): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('brand_assets')
    .delete()
    .eq('id', assetId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to delete asset: ${error.message}`)
}

/**
 * Record that an asset was used in a post.
 */
export async function markAssetUsed(assetId: string): Promise<void> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('brand_assets')
    .select('usage_count')
    .eq('id', assetId)
    .single()

  await supabase
    .from('brand_assets')
    .update({
      usage_count: (data?.usage_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', assetId)
}

/**
 * Smart asset picker — finds the best asset for a given context.
 * Used by the autopilot when it needs an image for a post.
 */
export async function pickBestAsset(
  userId: string,
  context: {
    platform?: Platform
    productName?: string
    category?: AssetCategory
    tags?: string[]
    preferUnused?: boolean
  }
): Promise<BrandAsset | null> {
  const assets = await listAssets(userId, {
    type: 'image',
    category: context.category,
    productName: context.productName,
    platform: context.platform,
    tags: context.tags,
    limit: 20,
  })

  if (assets.length === 0) return null

  if (context.preferUnused) {
    // Prefer least-used assets
    assets.sort((a, b) => a.usageCount - b.usageCount)
  }

  return assets[0]
}

// ============================================================================
// Content Templates
// ============================================================================

/**
 * Create a reusable content template.
 */
export async function createTemplate(
  options: {
    userId: string
    name: string
    description?: string
    platform: Platform
    contentType: 'text' | 'image_caption' | 'video_script'
    template: string
    tags?: string[]
  }
): Promise<ContentTemplate> {
  const supabase = getSupabase()

  // Extract variables from template ({{variable_name}} format)
  const variableMatches = options.template.match(/\{\{(\w+)\}\}/g) || []
  const variables = [...new Set(variableMatches.map(v => v.replace(/\{\{|\}\}/g, '')))]

  const { data, error } = await supabase
    .from('content_templates')
    .insert({
      user_id: options.userId,
      name: options.name,
      description: options.description || null,
      platform: options.platform,
      content_type: options.contentType,
      template: options.template,
      variables,
      tags: options.tags || [],
      usage_count: 0,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create template: ${error.message}`)
  return mapTemplateRecord(data)
}

/**
 * List content templates.
 */
export async function listTemplates(
  userId: string,
  options?: { platform?: Platform; limit?: number }
): Promise<ContentTemplate[]> {
  const supabase = getSupabase()

  let query = supabase
    .from('content_templates')
    .select('*')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .limit(options?.limit || 20)

  if (options?.platform) query = query.eq('platform', options.platform)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list templates: ${error.message}`)
  return (data || []).map(mapTemplateRecord)
}

/**
 * Apply a template with variable substitution.
 */
export async function applyTemplate(
  userId: string,
  templateId: string,
  variables: Record<string, string>
): Promise<string> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('content_templates')
    .select('template, variables')
    .eq('id', templateId)
    .eq('user_id', userId)
    .single()

  if (error || !data) throw new Error('Template not found')

  let result = data.template as string
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  // Mark as used
  await supabase
    .from('content_templates')
    .update({ usage_count: (data as { usage_count?: number }).usage_count || 0 + 1 })
    .eq('id', templateId)

  return result
}

// ============================================================================
// Brand Kit
// ============================================================================

/**
 * Save or update a brand kit.
 */
export async function saveBrandKit(
  userId: string,
  kit: Omit<BrandKit, 'id' | 'userId' | 'createdAt'>
): Promise<BrandKit> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('brand_kits')
    .upsert({
      user_id: userId,
      name: kit.name,
      logos: kit.logos,
      colors: kit.colors,
      fonts: kit.fonts || null,
      image_style: kit.imageStyle || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) throw new Error(`Failed to save brand kit: ${error.message}`)
  return mapBrandKitRecord(data)
}

/**
 * Get the brand kit for a user.
 */
export async function getBrandKit(userId: string): Promise<BrandKit | null> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', userId)
    .single()

  return data ? mapBrandKitRecord(data) : null
}

// ============================================================================
// Helpers
// ============================================================================

function inferMimeType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0]
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    pdf: 'application/pdf',
  }
  return mimeMap[ext || ''] || 'application/octet-stream'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAssetRecord(row: any): BrandAsset {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    category: row.category,
    name: row.name,
    description: row.description || undefined,
    url: row.url,
    thumbnailUrl: row.thumbnail_url || undefined,
    mimeType: row.mime_type,
    fileSize: row.file_size || undefined,
    dimensions: row.dimensions || undefined,
    tags: row.tags || [],
    productName: row.product_name || undefined,
    platforms: row.platforms || undefined,
    aspectRatio: row.aspect_ratio || undefined,
    usageCount: row.usage_count || 0,
    lastUsedAt: row.last_used_at || undefined,
    createdAt: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplateRecord(row: any): ContentTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description || undefined,
    platform: row.platform,
    contentType: row.content_type,
    template: row.template,
    variables: row.variables || [],
    tags: row.tags || [],
    usageCount: row.usage_count || 0,
    createdAt: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBrandKitRecord(row: any): BrandKit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    logos: row.logos || {},
    colors: row.colors || { primary: '#000', secondary: '#666', accent: '#007bff', background: '#fff' },
    fonts: row.fonts || undefined,
    imageStyle: row.image_style || undefined,
    createdAt: row.created_at,
  }
}
