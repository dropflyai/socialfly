import { NextRequest, NextResponse } from 'next/server'
import { exchangeInstagramCode, getInstagramProfile } from '@/lib/platforms/instagram'
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
    const tokens = await exchangeInstagramCode(code)
    const profile = await getInstagramProfile(
      tokens.access_token,
      tokens.instagram_business_account_id
    )

    const supabase = createServiceClient()
    const { error: dbError } = await supabase
      .from('platform_connections')
      .upsert({
        user_id: userId,
        platform: 'instagram',
        access_token: tokens.access_token,
        token_expires_at: new Date(tokens.expires_at).toISOString(),
        profile_id: tokens.instagram_business_account_id,
        profile_name: profile.name || profile.username,
        profile_handle: profile.username,
        profile_image_url: profile.profile_picture_url,
        status: 'active',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })

    if (dbError) throw dbError

    const response = NextResponse.redirect(
      new URL('/platforms?connected=instagram', request.url)
    )
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    console.error('Instagram OAuth error:', err)
    const message = err instanceof Error ? err.message : 'Instagram connection failed'
    return NextResponse.redirect(
      new URL(`/platforms?error=${encodeURIComponent(message)}`, request.url)
    )
  }
}
