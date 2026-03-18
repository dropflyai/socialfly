/**
 * Website Scraper for Brand Intelligence
 *
 * Extracts text content, metadata, and visual elements from websites
 * for brand voice and identity analysis.
 */

export interface ScrapedContent {
  url: string
  title: string
  description: string
  content: string
  headings: string[]
  links: string[]
  images: string[]
  metadata: {
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    twitterHandle?: string
    themeColor?: string
    keywords?: string[]
  }
  stats: {
    wordCount: number
    paragraphCount: number
    headingCount: number
    imageCount: number
  }
}

export interface ScrapeOptions {
  maxDepth?: number
  includeImages?: boolean
  timeout?: number
}

/**
 * Simple HTML parser to extract content
 * In production, we'd use a proper scraping service like Firecrawl
 */
function parseHTML(html: string, baseUrl: string): ScrapedContent {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  const description = descMatch ? descMatch[1].trim() : ''

  // Extract OG tags
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:site["'][^>]*content=["']([^"']+)["']/i)
  const themeMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
  const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i)

  // Extract headings
  const headingMatches = html.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi)
  const headings = Array.from(headingMatches).map(m => m[1].trim()).filter(Boolean)

  // Remove script, style, and nav elements for cleaner content
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Extract main content (paragraphs, divs with text)
  const textMatches = cleanHtml.matchAll(/<(p|div|article|section|span|li)[^>]*>([^<]+)/gi)
  const textParts = Array.from(textMatches)
    .map(m => m[2].trim())
    .filter(text => text.length > 20) // Filter out short fragments

  const content = textParts.join('\n\n')

  // Extract links
  const linkMatches = html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi)
  const links = Array.from(linkMatches)
    .map(m => {
      const href = m[1]
      if (href.startsWith('http')) return href
      if (href.startsWith('/')) return new URL(href, baseUrl).toString()
      return null
    })
    .filter((link): link is string => link !== null)

  // Extract images
  const imageMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)
  const images = Array.from(imageMatches)
    .map(m => {
      const src = m[1]
      if (src.startsWith('http')) return src
      if (src.startsWith('/')) return new URL(src, baseUrl).toString()
      if (src.startsWith('data:')) return null // Skip data URIs
      return new URL(src, baseUrl).toString()
    })
    .filter((img): img is string => img !== null)

  return {
    url: baseUrl,
    title,
    description,
    content,
    headings,
    links: [...new Set(links)].slice(0, 50),
    images: [...new Set(images)].slice(0, 20),
    metadata: {
      ogTitle: ogTitleMatch ? ogTitleMatch[1] : undefined,
      ogDescription: ogDescMatch ? ogDescMatch[1] : undefined,
      ogImage: ogImageMatch ? ogImageMatch[1] : undefined,
      twitterHandle: twitterMatch ? twitterMatch[1] : undefined,
      themeColor: themeMatch ? themeMatch[1] : undefined,
      keywords: keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()) : undefined,
    },
    stats: {
      wordCount: content.split(/\s+/).length,
      paragraphCount: textParts.length,
      headingCount: headings.length,
      imageCount: images.length,
    },
  }
}

/**
 * Scrape a website URL and extract content for brand analysis
 */
export async function scrapeWebsite(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapedContent> {
  const { timeout = 10000 } = options

  // Validate and normalize URL
  let normalizedUrl: URL
  try {
    normalizedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(normalizedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SocialFly-BrandBot/1.0 (https://socialfly.io)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    return parseHTML(html, normalizedUrl.origin)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`)
    }
    throw error
  }
}

/**
 * Scrape multiple pages from a website for deeper analysis
 */
export async function scrapeWebsiteDeep(
  url: string,
  maxPages: number = 5
): Promise<ScrapedContent[]> {
  const results: ScrapedContent[] = []
  const visited = new Set<string>()
  const queue: string[] = [url]

  while (queue.length > 0 && results.length < maxPages) {
    const currentUrl = queue.shift()!
    if (visited.has(currentUrl)) continue
    visited.add(currentUrl)

    try {
      const content = await scrapeWebsite(currentUrl)
      results.push(content)

      // Add internal links to queue
      const baseHost = new URL(url).host
      for (const link of content.links) {
        try {
          const linkUrl = new URL(link)
          if (linkUrl.host === baseHost && !visited.has(link)) {
            queue.push(link)
          }
        } catch {
          // Invalid URL, skip
        }
      }
    } catch (error) {
      console.error(`Failed to scrape ${currentUrl}:`, error)
    }
  }

  return results
}

/**
 * Extract Instagram profile data (basic - for full API access we'd need Instagram API)
 */
export async function scrapeInstagramProfile(handle: string): Promise<{
  handle: string
  bio?: string
  followers?: number
  following?: number
  posts?: number
  error?: string
}> {
  // Note: This is a basic implementation. For production, use Instagram Graph API
  const cleanHandle = handle.replace('@', '')

  try {
    const response = await fetch(`https://www.instagram.com/${cleanHandle}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return { handle: cleanHandle, error: 'Profile not found or private' }
    }

    const html = await response.text()

    // Try to extract data from page (limited due to Instagram's SPA nature)
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)

    return {
      handle: cleanHandle,
      bio: descMatch ? descMatch[1] : undefined,
    }
  } catch {
    return { handle: cleanHandle, error: 'Failed to fetch profile' }
  }
}
