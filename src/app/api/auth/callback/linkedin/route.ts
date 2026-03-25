import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  const storedState = request.cookies.get('oauth_state')?.value
  if (state !== storedState) {
    return NextResponse.redirect(new URL('/platforms?error=invalid_state', request.url))
  }

  let userId: string
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = parsed.userId
  } catch {
    return NextResponse.redirect(new URL('/platforms?error=invalid_state', request.url))
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/linkedin`,
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      throw new Error(`Token exchange failed: ${errText}`)
    }

    const tokens = await tokenRes.json()
    const accessToken = tokens.access_token
    const expiresIn = tokens.expires_in || 5184000 // 60 days default

    // Get user profile using OpenID userinfo
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    let profileName = 'LinkedIn User'
    let profileId = ''
    let profileHandle = ''

    if (profileRes.ok) {
      const profile = await profileRes.json()
      profileId = profile.sub || ''
      profileName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim()
      profileHandle = profile.email || profileName
    }

    // Store connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: dbError } = await supabase
      .from('platform_connections')
      .upsert({
        user_id: userId,
        platform: 'linkedin',
        access_token: accessToken,
        refresh_token: tokens.refresh_token || '',
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        profile_id: profileId,
        profile_name: profileName,
        profile_handle: profileHandle,
        status: 'active',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })

    if (dbError) throw dbError

    const response = NextResponse.redirect(
      new URL(`/platforms?connected=linkedin&name=${encodeURIComponent(profileName)}`, request.url)
    )
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    console.error('LinkedIn OAuth error:', err)
    return NextResponse.redirect(
      new URL(`/platforms?error=${encodeURIComponent('LinkedIn connection failed: ' + (err instanceof Error ? err.message : 'unknown'))}`, request.url)
    )
  }
}
