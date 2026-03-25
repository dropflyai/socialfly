/**
 * Simple in-memory rate limiter for API routes.
 *
 * For production at scale, swap to Upstash Redis (@upstash/ratelimit).
 * This works well for single-instance or low-traffic Vercel deployments.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 60_000)

interface RateLimitConfig {
  /** Max requests per window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given key (usually `userId:endpoint`).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // No entry or window expired — start fresh
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowSeconds * 1000
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.limit - 1, resetAt }
  }

  // Within window — check count
  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Rate limit presets for different endpoint types.
 */
export const RATE_LIMITS = {
  /** AI content generation — expensive (Anthropic API) */
  aiGenerate: { limit: 10, windowSeconds: 60 },

  /** Image generation — expensive (FAL API) */
  imageGenerate: { limit: 5, windowSeconds: 60 },

  /** Video generation — very expensive */
  videoGenerate: { limit: 3, windowSeconds: 60 },

  /** Publishing to social platforms */
  publish: { limit: 20, windowSeconds: 60 },

  /** Media upload */
  mediaUpload: { limit: 30, windowSeconds: 60 },

  /** General API calls */
  general: { limit: 60, windowSeconds: 60 },
} as const
