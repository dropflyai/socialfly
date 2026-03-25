// TikTok Content Posting API
// Docs: https://developers.tiktok.com/doc/content-posting-api-get-started

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'
const TIKTOK_AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize'

// In sandbox mode, TikTok only allows SELF_ONLY privacy
const TIKTOK_PRIVACY_LEVEL = process.env.TIKTOK_SANDBOX === 'true'
  ? 'SELF_ONLY'
  : 'PUBLIC_TO_EVERYONE'

export interface TikTokTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  open_id: string
}

export interface TikTokProfile {
  open_id: string
  display_name: string
  avatar_url: string
  username?: string
}

export interface TikTokPostResult {
  publish_id: string
}

// OAuth 2.0 flow
export function getTikTokAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    response_type: 'code',
    scope: 'user.info.basic,video.publish,video.upload',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/tiktok`,
    state,
  })

  return `${TIKTOK_AUTH_BASE}/?${params.toString()}`
}

export async function exchangeTikTokCode(code: string): Promise<TikTokTokens> {
  const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/tiktok`,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`TikTok token exchange failed: ${error}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    open_id: data.open_id,
  }
}

export async function refreshTikTokToken(
  refreshToken: string
): Promise<TikTokTokens> {
  const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error('Failed to refresh TikTok token')
  const data = await res.json()

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    open_id: data.open_id,
  }
}

export async function getTikTokProfile(
  accessToken: string
): Promise<TikTokProfile> {
  const res = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=open_id,display_name,avatar_url,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error('Failed to get TikTok profile')
  const data = await res.json()
  return data.data.user
}

// Post video to TikTok using "pull from URL" method
export async function postTikTokVideo(
  accessToken: string,
  videoUrl: string,
  title: string
): Promise<TikTokPostResult> {
  // Step 1: Initialize upload via pull from URL
  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: title.slice(0, 150), // TikTok title limit
        privacy_level: TIKTOK_PRIVACY_LEVEL,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  })

  if (!initRes.ok) {
    const error = await initRes.text()
    throw new Error(`TikTok video init failed: ${error}`)
  }

  const initData = await initRes.json()

  if (initData.error?.code !== 'ok' && initData.error?.code) {
    throw new Error(`TikTok error: ${initData.error.message}`)
  }

  return { publish_id: initData.data.publish_id }
}

// Post a photo to TikTok (photo mode)
export async function postTikTokPhoto(
  accessToken: string,
  imageUrls: string[],
  title: string
): Promise<TikTokPostResult> {
  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/content/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: title.slice(0, 150),
        privacy_level: TIKTOK_PRIVACY_LEVEL,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: imageUrls,
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    }),
  })

  if (!initRes.ok) {
    const error = await initRes.text()
    throw new Error(`TikTok photo post failed: ${error}`)
  }

  const data = await initRes.json()
  return { publish_id: data.data.publish_id }
}

// Check publish status
export async function getTikTokPublishStatus(
  accessToken: string,
  publishId: string
): Promise<{ status: string; fail_reason?: string }> {
  const res = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publish_id: publishId }),
  })

  if (!res.ok) throw new Error('Failed to check TikTok publish status')
  const data = await res.json()
  return {
    status: data.data.status,
    fail_reason: data.data.fail_reason,
  }
}
