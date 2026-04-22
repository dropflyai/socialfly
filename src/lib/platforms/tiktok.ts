// TikTok Content Posting API
// Docs: https://developers.tiktok.com/doc/content-posting-api-get-started

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'
const TIKTOK_AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize'

// In sandbox / unaudited mode, TikTok only allows SELF_ONLY privacy.
// Trim the env var so stray whitespace (e.g. a trailing newline from
// `echo "true" | vercel env add`) doesn't silently flip the check.
const TIKTOK_PRIVACY_LEVEL = process.env.TIKTOK_SANDBOX?.trim() === 'true'
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
  // `username` is gated behind the `user.info.profile` scope and will cause
  // the request to fail when only `user.info.basic` is granted. Only ask for
  // fields that our current scope list covers.
  const res = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=open_id,display_name,avatar_url`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to get TikTok profile (${res.status}): ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  if (data.error?.code && data.error.code !== 'ok') {
    throw new Error(`TikTok profile error: ${data.error.code} — ${data.error.message}`)
  }
  return data.data.user
}

// Post video to TikTok via FILE_UPLOAD.
//
// We can't use PULL_FROM_URL because TikTok requires DNS-verified domain
// ownership for the source URL, and our videos live on FAL's CDN (not a
// domain we control). FILE_UPLOAD sidesteps that: we download the video
// server-side and PUT the bytes to an upload_url TikTok gives us.
export async function postTikTokVideo(
  accessToken: string,
  videoUrl: string,
  title: string
): Promise<TikTokPostResult> {
  // Download the video so we know its size (required by init) and can stream
  // it to TikTok's upload URL.
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) throw new Error(`Failed to download video from source: ${videoRes.status}`)
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
  const videoSize = videoBuffer.byteLength

  // Single-chunk upload. TikTok's 5MB minimum chunk size only applies when
  // splitting into multiple chunks — a single chunk can be up to 64MB.
  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: title.slice(0, 150),
        privacy_level: TIKTOK_PRIVACY_LEVEL,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  })

  if (!initRes.ok) {
    const error = await initRes.text()
    throw new Error(`TikTok video init failed: ${error}`)
  }

  const initData = await initRes.json()
  if (initData.error?.code && initData.error.code !== 'ok') {
    throw new Error(`TikTok error: ${initData.error.message}`)
  }

  const { publish_id, upload_url } = initData.data
  if (!upload_url) throw new Error('TikTok did not return an upload_url')

  // PUT the video bytes. Content-Range is required for chunked upload; for a
  // single chunk it covers the full file.
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: videoBuffer,
  })

  if (!uploadRes.ok) {
    const error = await uploadRes.text()
    throw new Error(`TikTok video upload failed (${uploadRes.status}): ${error.slice(0, 300)}`)
  }

  return { publish_id }
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
