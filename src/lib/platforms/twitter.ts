import crypto from 'crypto'

// Twitter API v2 client
// Docs: https://developer.twitter.com/en/docs/twitter-api

const TWITTER_API_BASE = 'https://api.twitter.com/2'
const TWITTER_UPLOAD_BASE = 'https://upload.twitter.com/1.1'

export interface TwitterTokens {
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface TwitterProfile {
  id: string
  name: string
  username: string
  profile_image_url?: string
}

export interface TweetResult {
  id: string
  text: string
}

// OAuth 2.0 PKCE flow for Twitter
export function getTwitterAuthUrl(state: string, codeVerifier: string): string {
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TWITTER_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/twitter`,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
}

export async function exchangeTwitterCode(
  code: string,
  codeVerifier: string
): Promise<TwitterTokens> {
  const credentials = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/twitter`,
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Twitter token exchange failed: ${error}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshTwitterToken(
  refreshToken: string
): Promise<TwitterTokens> {
  const credentials = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    throw new Error('Failed to refresh Twitter token')
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
}

export async function getTwitterProfile(
  accessToken: string
): Promise<TwitterProfile> {
  const res = await fetch(`${TWITTER_API_BASE}/users/me?user.fields=profile_image_url`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error('Failed to get Twitter profile')
  const data = await res.json()
  return data.data
}

export async function postTweet(
  accessToken: string,
  text: string,
  mediaIds?: string[]
): Promise<TweetResult> {
  const body: Record<string, unknown> = { text }
  if (mediaIds?.length) {
    body.media = { media_ids: mediaIds }
  }

  const res = await fetch(`${TWITTER_API_BASE}/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Failed to post tweet: ${error}`)
  }

  const data = await res.json()
  return data.data
}

// Upload media (images/videos) for tweets
export async function uploadTwitterMedia(
  accessToken: string,
  mediaBuffer: Buffer,
  mediaType: string
): Promise<string> {
  // Twitter media upload uses v1.1 API with OAuth 1.0a or Bearer token
  // For large files (video), use chunked upload
  const isVideo = mediaType.startsWith('video/')

  if (isVideo) {
    return uploadTwitterMediaChunked(accessToken, mediaBuffer, mediaType)
  }

  // Simple upload for images
  const formData = new FormData()
  formData.append('media_data', mediaBuffer.toString('base64'))

  const res = await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })

  if (!res.ok) throw new Error('Failed to upload media to Twitter')
  const data = await res.json()
  return data.media_id_string
}

async function uploadTwitterMediaChunked(
  accessToken: string,
  mediaBuffer: Buffer,
  mediaType: string
): Promise<string> {
  const totalBytes = mediaBuffer.length

  // INIT
  const initRes = await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: totalBytes.toString(),
      media_type: mediaType,
    }),
  })

  if (!initRes.ok) throw new Error('Twitter media INIT failed')
  const { media_id_string: mediaId } = await initRes.json()

  // APPEND (5MB chunks)
  const chunkSize = 5 * 1024 * 1024
  for (let i = 0; i * chunkSize < totalBytes; i++) {
    const chunk = mediaBuffer.subarray(i * chunkSize, (i + 1) * chunkSize)
    const formData = new FormData()
    formData.append('command', 'APPEND')
    formData.append('media_id', mediaId)
    formData.append('segment_index', i.toString())
    formData.append('media_data', chunk.toString('base64'))

    const appendRes = await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    })

    if (!appendRes.ok) throw new Error(`Twitter media APPEND failed at segment ${i}`)
  }

  // FINALIZE
  const finalRes = await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId,
    }),
  })

  if (!finalRes.ok) throw new Error('Twitter media FINALIZE failed')
  return mediaId
}
