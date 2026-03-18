/**
 * Brand Analyzer
 *
 * Orchestrates the brand intelligence pipeline:
 * 1. Scrape website content
 * 2. Analyze with Claude
 * 3. Store brand profile
 */

import { scrapeWebsite, scrapeWebsiteDeep, type ScrapedContent } from './scraper'
import { analyzeWebsiteContent, type FullBrandAnalysis } from '../ai/claude'

export interface BrandAnalysisInput {
  url?: string
  instagramHandle?: string
  manualDescription?: string
  analysisDepth?: 'quick' | 'standard' | 'deep'
}

export interface BrandAnalysisResult {
  success: boolean
  analysis?: FullBrandAnalysis
  scrapedContent?: ScrapedContent[]
  error?: string
  metadata: {
    pagesAnalyzed: number
    wordCount: number
    analysisTime: number
    tokensUsed?: number
  }
}

export interface BrandProfileData {
  name: string
  source_url?: string
  source_type: 'website' | 'instagram' | 'facebook' | 'manual'
  description?: string
  voice_tone: string
  voice_description?: string
  voice_vocabulary: string[]
  voice_personality: Record<string, unknown>
  color_primary: string
  color_secondary: string
  color_accent?: string
  image_style?: string
  target_audience?: string
  target_demographics: Record<string, unknown>
  target_interests: string[]
  target_pain_points: string[]
  content_pillars: string[]
  hashtag_sets: Record<string, string[]>
  competitor_urls: string[]
  industry?: string
  raw_analysis: Record<string, unknown>
}

/**
 * Analyze a brand from URL and return structured profile data
 */
export async function analyzeBrand(
  input: BrandAnalysisInput
): Promise<BrandAnalysisResult> {
  const startTime = Date.now()

  try {
    // Determine analysis depth
    const maxPages = input.analysisDepth === 'deep' ? 10 :
                     input.analysisDepth === 'quick' ? 1 : 5

    // Scrape content
    let scrapedContent: ScrapedContent[] = []

    if (input.url) {
      if (maxPages === 1) {
        const content = await scrapeWebsite(input.url)
        scrapedContent = [content]
      } else {
        scrapedContent = await scrapeWebsiteDeep(input.url, maxPages)
      }
    }

    if (scrapedContent.length === 0 && !input.manualDescription) {
      return {
        success: false,
        error: 'No content could be extracted from the URL',
        metadata: {
          pagesAnalyzed: 0,
          wordCount: 0,
          analysisTime: Date.now() - startTime,
        },
      }
    }

    // Combine all scraped content for analysis
    const combinedContent = scrapedContent
      .map(page => `
## Page: ${page.title || page.url}
${page.description ? `Description: ${page.description}` : ''}
${page.headings.length > 0 ? `\nHeadings:\n${page.headings.map(h => `- ${h}`).join('\n')}` : ''}

Content:
${page.content}
      `.trim())
      .join('\n\n---\n\n')

    const totalContent = input.manualDescription
      ? `${input.manualDescription}\n\n${combinedContent}`
      : combinedContent

    const totalWordCount = totalContent.split(/\s+/).length

    // Analyze with Claude
    const analysis = await analyzeWebsiteContent(
      totalContent,
      input.url || 'manual input'
    )

    return {
      success: true,
      analysis,
      scrapedContent,
      metadata: {
        pagesAnalyzed: scrapedContent.length,
        wordCount: totalWordCount,
        analysisTime: Date.now() - startTime,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during analysis',
      metadata: {
        pagesAnalyzed: 0,
        wordCount: 0,
        analysisTime: Date.now() - startTime,
      },
    }
  }
}

/**
 * Convert analysis result to database-ready brand profile data
 */
export function analysisToProfileData(
  analysis: FullBrandAnalysis,
  sourceUrl: string,
  sourceType: 'website' | 'instagram' | 'facebook' | 'manual' = 'website'
): BrandProfileData {
  // Extract brand name from URL or use a placeholder
  let brandName = 'My Brand'
  try {
    const url = new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`)
    brandName = url.hostname.replace('www.', '').split('.')[0]
    brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1)
  } catch {
    // Use default
  }

  return {
    name: brandName,
    source_url: sourceUrl,
    source_type: sourceType,
    description: analysis.summary,
    voice_tone: analysis.voice.tone,
    voice_description: analysis.voice.personality.description,
    voice_vocabulary: analysis.voice.vocabulary,
    voice_personality: analysis.voice.personality as Record<string, unknown>,
    color_primary: analysis.visualStyle.colors.primary || '#6366F1',
    color_secondary: analysis.visualStyle.colors.secondary || '#8B5CF6',
    color_accent: analysis.visualStyle.colors.accent,
    image_style: analysis.visualStyle.style,
    target_audience: analysis.audience.demographics.ageRange + ' - ' +
                     analysis.audience.demographics.gender,
    target_demographics: analysis.audience.demographics as Record<string, unknown>,
    target_interests: analysis.audience.interests,
    target_pain_points: analysis.audience.painPoints,
    content_pillars: analysis.content.pillars.map(p => p.name),
    hashtag_sets: analysis.content.hashtags as Record<string, string[]>,
    competitor_urls: analysis.competitors,
    industry: analysis.content.pillars[0]?.keywords[0] || undefined,
    raw_analysis: analysis as unknown as Record<string, unknown>,
  }
}

/**
 * Quick validation that a URL is valid and accessible
 */
export async function validateUrl(url: string): Promise<{
  valid: boolean
  normalizedUrl?: string
  error?: string
}> {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`
    const urlObj = new URL(normalized)

    // Quick HEAD request to check accessibility
    const response = await fetch(normalized, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return {
        valid: false,
        error: `URL returned ${response.status}: ${response.statusText}`,
      }
    }

    return {
      valid: true,
      normalizedUrl: urlObj.toString(),
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid URL',
    }
  }
}
