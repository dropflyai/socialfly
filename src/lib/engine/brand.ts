/**
 * Brand Voice Management
 *
 * Load and apply brand voice profiles to content generation.
 */

import { getSupabase } from './config'
import type { BrandVoice } from './types'

/**
 * Load a brand voice profile by ID.
 * If no ID provided, loads the user's default brand.
 */
export async function loadBrandVoice(
  userId: string,
  brandId?: string
): Promise<BrandVoice | null> {
  const supabase = getSupabase()

  let query = supabase
    .from('brand_profiles')
    .select('id, name, voice_tone, voice_description, voice_vocabulary, target_audience, industry, hashtag_sets')
    .eq('user_id', userId)

  if (brandId) {
    query = query.eq('id', brandId)
  } else {
    query = query.eq('is_default', true)
  }

  const { data } = await query.single()
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    tone: data.voice_tone,
    description: data.voice_description || undefined,
    vocabulary: data.voice_vocabulary || [],
    targetAudience: data.target_audience || undefined,
    industry: data.industry || undefined,
    hashtagSets: data.hashtag_sets || {},
  }
}

/**
 * Build the brand context string for injection into AI prompts.
 */
export function buildBrandContext(brand: BrandVoice): string {
  const parts = [`Brand: ${brand.name}`, `Tone: ${brand.tone}`]

  if (brand.description) parts.push(`Voice: ${brand.description}`)
  if (brand.targetAudience) parts.push(`Audience: ${brand.targetAudience}`)
  if (brand.industry) parts.push(`Industry: ${brand.industry}`)
  if (brand.vocabulary?.length) parts.push(`Key words: ${brand.vocabulary.join(', ')}`)

  return parts.join('\n')
}
