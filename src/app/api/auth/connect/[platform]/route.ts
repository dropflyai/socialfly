import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import crypto from 'crypto'
import { getTwitterAuthUrl } from '@/lib/platforms/twitter'
import { getInstagramAuthUrl } from '@/lib/platforms/instagram'
import { getFacebookAuthUrl } from '@/lib/platforms/facebook'
import { getTikTokAuthUrl } from '@/lib/platforms/tiktok'
import { getLinkedInAuthUrl } from '@/lib/platforms/linkedin'
import { checkPlatformLimit } from '@/lib/tier-gates'

// GET /api/auth/connect/[platform] — initiates OAuth flow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Check platform connection limit
  const platformCheck = await checkPlatformLimit(user.id)
  if (!platformCheck.allowed) {
    return NextResponse.redirect(
      new URL(`/platforms?error=${encodeURIComponent(platformCheck.reason || 'Platform limit reached')}`, request.url)
    )
  }

  // Generate state with user ID for verification on callback
  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    platform,
    nonce: crypto.randomBytes(16).toString('hex'),
  })).toString('base64url')

  let authUrl: string

  switch (platform) {
    case 'twitter': {
      // Generate PKCE code verifier and store it in a cookie
      const codeVerifier = crypto.randomBytes(32).toString('base64url')
      authUrl = getTwitterAuthUrl(state, codeVerifier)

      const response = NextResponse.redirect(authUrl)
      response.cookies.set('twitter_code_verifier', codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600, // 10 minutes
        path: '/',
      })
      response.cookies.set('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/',
      })
      return response
    }

    case 'instagram':
      authUrl = getInstagramAuthUrl(state)
      break

    case 'facebook':
      authUrl = getFacebookAuthUrl(state)
      break

    case 'tiktok':
      authUrl = getTikTokAuthUrl(state)
      break

    case 'linkedin':
      authUrl = getLinkedInAuthUrl(state)
      break

    default:
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  }

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return response
}
