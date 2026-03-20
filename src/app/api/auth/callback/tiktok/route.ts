import { NextRequest, NextResponse } from 'next/server'
import { exchangeTikTokCode, getTikTokProfile } from '@/lib/platforms/tiktok'
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
    const tokens = await exchangeTikTokCode(code)
    const profile = await getTikTokProfile(tokens.access_token)

    const supabase = createServiceClient()
    const { error: dbError } = await supabase
      .from('platform_connections')
      .upsert({
        user_id: userId,
        platform: 'tiktok',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(tokens.expires_at).toISOString(),
        profile_id: tokens.open_id,
        profile_name: profile.display_name,
        profile_handle: profile.username || profile.display_name,
        profile_image_url: profile.avatar_url,
        status: 'active',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })

    if (dbError) throw dbError

    const response = NextResponse.redirect(
      new URL('/platforms?connected=tiktok', request.url)
    )
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    console.error('TikTok OAuth error:', err)
    return NextResponse.redirect(
      new URL(`/platforms?error=${encodeURIComponent('TikTok connection failed')}`, request.url)
    )
  }
}
