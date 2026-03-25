import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeLinkedInCode, getLinkedInProfile } from '@/lib/platforms/linkedin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/auth/callback/linkedin — handle LinkedIn OAuth callback
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('LinkedIn OAuth error:', error)
    return NextResponse.redirect(new URL('/platforms?error=linkedin_denied', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/platforms?error=missing_params', request.url))
  }

  // Verify state
  const storedState = request.cookies.get('oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL('/platforms?error=invalid_state', request.url))
  }

  try {
    // Decode state to get user ID
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    const userId = stateData.userId

    if (!userId) {
      return NextResponse.redirect(new URL('/platforms?error=no_user', request.url))
    }

    // Exchange code for tokens
    const tokens = await exchangeLinkedInCode(code)

    // Get profile info
    let profileName = 'LinkedIn User'
    let profileHandle = ''
    let profileId = ''
    try {
      const profile = await getLinkedInProfile(tokens.access_token)
      profileName = `${profile.localizedFirstName} ${profile.localizedLastName}`
      profileId = profile.id
      profileHandle = profile.id
    } catch (e) {
      console.error('Failed to get LinkedIn profile:', e)
    }

    // Clean userId (remove any newlines/spaces)
    const cleanUserId = userId.trim().replace(/\n/g, '')

    // Store connection in database
    const { error: dbError } = await supabase
      .from('platform_connections')
      .upsert({
        user_id: cleanUserId,
        platform: 'linkedin',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(tokens.expires_at).toISOString(),
        profile_id: profileId,
        profile_name: profileName,
        profile_handle: profileHandle,
        status: 'active',
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform',
      })

    if (dbError) {
      console.error('Failed to store LinkedIn connection:', dbError)
      return NextResponse.redirect(new URL('/platforms?error=db_error', request.url))
    }

    // Clear the state cookie
    const response = NextResponse.redirect(new URL('/platforms?connected=linkedin', request.url))
    response.cookies.delete('oauth_state')
    return response
  } catch (e) {
    console.error('LinkedIn callback error:', e)
    return NextResponse.redirect(new URL('/platforms?error=exchange_failed', request.url))
  }
}
