import { NextRequest, NextResponse } from 'next/server'
import { exchangeFacebookCode, getFacebookProfile } from '@/lib/platforms/facebook'
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

  let userId: string
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = parsed.userId
  } catch {
    return NextResponse.redirect(new URL('/platforms?error=invalid_state', request.url))
  }

  try {
    const tokens = await exchangeFacebookCode(code)
    const profile = await getFacebookProfile(tokens.access_token, tokens.page_id)

    const supabase = createServiceClient()
    const { error: dbError } = await supabase
      .from('platform_connections')
      .upsert({
        user_id: userId,
        platform: 'facebook',
        access_token: tokens.access_token,
        token_expires_at: new Date(tokens.expires_at).toISOString(),
        profile_id: tokens.page_id,
        profile_name: tokens.page_name,
        profile_handle: tokens.page_name,
        profile_image_url: profile.picture?.data?.url || null,
        status: 'active',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })

    if (dbError) throw dbError

    const response = NextResponse.redirect(
      new URL('/platforms?connected=facebook', request.url)
    )
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    console.error('Facebook OAuth error:', err)
    const message = err instanceof Error ? err.message : 'Facebook connection failed'
    return NextResponse.redirect(
      new URL(`/platforms?error=${encodeURIComponent(message)}`, request.url)
    )
  }
}
