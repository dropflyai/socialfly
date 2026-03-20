import { NextRequest, NextResponse } from 'next/server'
import { exchangeTwitterCode, getTwitterProfile } from '@/lib/platforms/twitter'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/platforms?error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/platforms?error=missing_params', request.url))
  }

  // Verify state
  const storedState = request.cookies.get('oauth_state')?.value
  if (state !== storedState) {
    return NextResponse.redirect(new URL('/platforms?error=invalid_state', request.url))
  }

  // Parse state to get userId
  let userId: string
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = parsed.userId
  } catch {
    return NextResponse.redirect(new URL('/platforms?error=invalid_state', request.url))
  }

  // Get PKCE code verifier from cookie
  const codeVerifier = request.cookies.get('twitter_code_verifier')?.value
  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/platforms?error=missing_verifier', request.url))
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeTwitterCode(code, codeVerifier)

    // Get profile info
    const profile = await getTwitterProfile(tokens.access_token)

    // Save to database
    const supabase = createServiceClient()
    const { error: dbError } = await supabase
      .from('platform_connections')
      .upsert({
        user_id: userId,
        platform: 'twitter',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(tokens.expires_at).toISOString(),
        profile_id: profile.id,
        profile_name: profile.name,
        profile_handle: profile.username,
        profile_image_url: profile.profile_image_url,
        status: 'active',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })

    if (dbError) throw dbError

    const response = NextResponse.redirect(
      new URL('/platforms?connected=twitter', request.url)
    )
    // Clear cookies
    response.cookies.delete('twitter_code_verifier')
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    console.error('Twitter OAuth error:', err)
    return NextResponse.redirect(
      new URL(`/platforms?error=${encodeURIComponent('Twitter connection failed')}`, request.url)
    )
  }
}
