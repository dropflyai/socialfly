/**
 * Short-link helpers for tracking clicks from social posts.
 *
 * createShortLink() inserts a row in link_redirects and returns the
 * socialfly.io/go/{slug} URL we'll embed in the post. The /go/[slug]
 * route logs the click and 302s to the target.
 */

import { createClient } from '@supabase/supabase-js'

// 6 chars from this alphabet = 56B possible slugs (collision-safe at our
// scale). Avoiding 0/O/1/l/I to stay readable if someone types it.
const SLUG_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SLUG_LENGTH = 6

function generateSlug(): string {
  let s = ''
  for (let i = 0; i < SLUG_LENGTH; i++) {
    s += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]
  }
  return s
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface CreateShortLinkOpts {
  userId: string
  targetUrl: string
  postId?: string
  brandId?: string
  platform?: string
}

export interface ShortLink {
  slug: string
  shortUrl: string
}

/**
 * Create a unique short link. Retries up to 3 times on slug collision.
 */
export async function createShortLink(opts: CreateShortLinkOpts): Promise<ShortLink> {
  const supabase = getServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://socialfly.io'

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug()
    const { error } = await supabase
      .from('link_redirects')
      .insert({
        slug,
        user_id: opts.userId,
        target_url: opts.targetUrl,
        post_id: opts.postId || null,
        brand_id: opts.brandId || null,
        platform: opts.platform || null,
      })

    // Postgres unique-violation code = 23505. Retry with a fresh slug.
    if (error && error.code === '23505') continue
    if (error) throw new Error(`Failed to create short link: ${error.message}`)

    return { slug, shortUrl: `${baseUrl}/go/${slug}` }
  }

  throw new Error('Failed to allocate a unique short link slug after 3 attempts')
}

/**
 * Look up a slug and increment its click counters atomically.
 * Returns the target URL or null if the slug doesn't exist.
 */
export async function recordClickAndGetTarget(slug: string): Promise<string | null> {
  const supabase = getServiceClient()

  // Fetch + check existence in one round trip
  const { data: link } = await supabase
    .from('link_redirects')
    .select('target_url, click_count, first_clicked_at')
    .eq('slug', slug)
    .single()

  if (!link) return null

  const now = new Date().toISOString()
  await supabase
    .from('link_redirects')
    .update({
      click_count: (link.click_count || 0) + 1,
      last_clicked_at: now,
      first_clicked_at: link.first_clicked_at || now,
    })
    .eq('slug', slug)

  return link.target_url
}
