/**
 * GET /go/[slug] — short-link redirect with click tracking.
 *
 * Looks up the slug in link_redirects, increments its click counter,
 * and 302s to the stored target_url. Falls back to the homepage on
 * unknown slugs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { recordClickAndGetTarget } from '@/lib/links'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Reject obvious non-slug noise (bots probing /go/something.php etc.)
  if (!slug || slug.length > 64 || !/^[A-Za-z0-9_-]+$/.test(slug)) {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'https://socialfly.io'))
  }

  let target: string | null = null
  try {
    target = await recordClickAndGetTarget(slug)
  } catch (err) {
    console.error('[/go/:slug] click tracking failed:', err)
    // Don't block the redirect on a logging failure — fall through with null
  }

  if (!target) {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'https://socialfly.io'))
  }

  // 302 (temporary) so search engines don't index the short link as the
  // canonical URL, and so we get a fresh hit on every click.
  return NextResponse.redirect(target, 302)
}
