// Unified platform manager — handles token refresh and publishing across all platforms

import { createClient } from '@supabase/supabase-js'
import { refreshTwitterToken, postTweet, uploadTwitterMedia } from './twitter'
import {
  refreshInstagramToken,
  postInstagramImage,
  postInstagramReel,
  postInstagramCarousel,
} from './instagram'
import { refreshTikTokToken, postTikTokVideo, postTikTokPhoto } from './tiktok'
import {
  refreshFacebookToken,
  postFacebookText,
  postFacebookImage,
  postFacebookVideo,
} from './facebook'
import {
  refreshLinkedInToken,
  postLinkedInText,
  postLinkedInImage,
} from './linkedin'

type Platform = 'twitter' | 'instagram' | 'tiktok' | 'facebook' | 'linkedin'

interface PlatformConnection {
  id: string
  platform: Platform
  access_token: string
  refresh_token: string
  token_expires_at: string
  profile_id: string
  profile_name: string
  profile_handle: string
  status: string
  metadata?: Record<string, string>
}

interface PublishRequest {
  platform: Platform
  text: string
  mediaUrls?: string[]
  mediaType?: 'image' | 'video' | 'carousel'
}

interface PublishResult {
  platform: Platform
  success: boolean
  platformPostId?: string
  error?: string
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Get a valid access token, refreshing if expired
export async function getValidToken(
  connection: PlatformConnection
): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at).getTime()
  const buffer = 5 * 60 * 1000 // 5 min buffer

  if (Date.now() < expiresAt - buffer) {
    return connection.access_token
  }

  // Token expired or expiring soon — refresh it
  const supabase = getServiceClient()
  let newTokens: { access_token: string; refresh_token?: string; expires_at: number }

  switch (connection.platform) {
    case 'twitter':
      newTokens = await refreshTwitterToken(connection.refresh_token)
      break
    case 'instagram': {
      const igResult = await refreshInstagramToken(connection.access_token)
      newTokens = { ...igResult, refresh_token: undefined }
      break
    }
    case 'tiktok':
      newTokens = await refreshTikTokToken(connection.refresh_token)
      break
    case 'facebook': {
      const fbResult = await refreshFacebookToken(connection.access_token)
      newTokens = { ...fbResult, refresh_token: undefined }
      break
    }
    case 'linkedin':
      newTokens = await refreshLinkedInToken(connection.refresh_token)
      break
    default:
      throw new Error(`Unsupported platform: ${connection.platform}`)
  }

  // Update tokens in database
  await supabase
    .from('platform_connections')
    .update({
      access_token: newTokens.access_token,
      ...(newTokens.refresh_token && { refresh_token: newTokens.refresh_token }),
      token_expires_at: new Date(newTokens.expires_at).toISOString(),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  return newTokens.access_token
}

// Publish to a single platform
export async function publishToplatform(
  connection: PlatformConnection,
  request: PublishRequest
): Promise<PublishResult> {
  try {
    const token = await getValidToken(connection)
    let platformPostId: string | undefined

    switch (request.platform) {
      case 'twitter': {
        let mediaIds: string[] | undefined
        if (request.mediaUrls?.length) {
          mediaIds = []
          for (const url of request.mediaUrls) {
            const res = await fetch(url)
            const buffer = Buffer.from(await res.arrayBuffer())
            const contentType = res.headers.get('content-type') || 'image/jpeg'
            const mediaId = await uploadTwitterMedia(token, buffer, contentType)
            mediaIds.push(mediaId)
          }
        }
        const tweet = await postTweet(token, request.text, mediaIds)
        platformPostId = tweet.id
        break
      }

      case 'instagram': {
        const igAccountId = connection.profile_id
        if (request.mediaType === 'video' && request.mediaUrls?.[0]) {
          const result = await postInstagramReel(token, igAccountId, request.mediaUrls[0], request.text)
          platformPostId = result.id
        } else if (request.mediaType === 'carousel' && request.mediaUrls?.length) {
          const result = await postInstagramCarousel(token, igAccountId, request.mediaUrls, request.text)
          platformPostId = result.id
        } else if (request.mediaUrls?.[0]) {
          const result = await postInstagramImage(token, igAccountId, request.mediaUrls[0], request.text)
          platformPostId = result.id
        } else {
          throw new Error('Instagram requires at least one image or video')
        }
        break
      }

      case 'tiktok': {
        if (request.mediaType === 'video' && request.mediaUrls?.[0]) {
          const result = await postTikTokVideo(token, request.mediaUrls[0], request.text)
          platformPostId = result.publish_id
        } else if (request.mediaUrls?.length) {
          const result = await postTikTokPhoto(token, request.mediaUrls, request.text)
          platformPostId = result.publish_id
        } else {
          throw new Error('TikTok requires a video or photos')
        }
        break
      }

      case 'facebook': {
        const pageId = connection.profile_id
        if (request.mediaType === 'video' && request.mediaUrls?.[0]) {
          const result = await postFacebookVideo(token, pageId, request.mediaUrls[0], request.text)
          platformPostId = result.id
        } else if (request.mediaUrls?.[0]) {
          const result = await postFacebookImage(token, pageId, request.mediaUrls[0], request.text)
          platformPostId = result.id
        } else {
          // Facebook supports text-only posts
          const result = await postFacebookText(token, pageId, request.text)
          platformPostId = result.id
        }
        break
      }

      case 'linkedin': {
        // LinkedIn author URN — can be person or organization
        const authorUrn = connection.metadata?.organization_id
          ? `urn:li:organization:${connection.metadata.organization_id}`
          : `urn:li:person:${connection.profile_id}`

        if (request.mediaUrls?.[0] && request.mediaType === 'image') {
          const result = await postLinkedInImage(token, authorUrn, request.mediaUrls[0], request.text)
          platformPostId = result.id
        } else {
          // LinkedIn supports text-only posts
          const result = await postLinkedInText(token, authorUrn, request.text)
          platformPostId = result.id
        }
        break
      }
    }

    return { platform: request.platform, success: true, platformPostId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    // Mark connection as error if auth fails
    if (message.includes('401') || message.includes('token') || message.includes('expired')) {
      const supabase = getServiceClient()
      await supabase
        .from('platform_connections')
        .update({ status: 'error', error_message: message })
        .eq('id', connection.id)
    }

    return { platform: request.platform, success: false, error: message }
  }
}

// Get a fallback connection from env vars (for owner's own accounts)
function getEnvConnection(platform: Platform): PlatformConnection | null {
  if (platform === 'instagram' && process.env.INSTAGRAM_PAGE_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID) {
    return {
      id: 'env-instagram',
      platform: 'instagram',
      access_token: process.env.INSTAGRAM_PAGE_TOKEN,
      refresh_token: '',
      token_expires_at: '2099-01-01T00:00:00Z',
      profile_id: process.env.INSTAGRAM_ACCOUNT_ID,
      profile_name: 'dropfly.ai',
      profile_handle: '@dropfly.ai',
      status: 'active',
    }
  }

  if (platform === 'facebook' && process.env.FACEBOOK_PAGE_TOKEN && process.env.FACEBOOK_PAGE_ID) {
    return {
      id: 'env-facebook',
      platform: 'facebook',
      access_token: process.env.FACEBOOK_PAGE_TOKEN,
      refresh_token: '',
      token_expires_at: '2099-01-01T00:00:00Z',
      profile_id: process.env.FACEBOOK_PAGE_ID,
      profile_name: 'DropFly',
      profile_handle: '@dropfly',
      status: 'active',
    }
  }

  if (platform === 'linkedin' && process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_PERSON_ID) {
    return {
      id: 'env-linkedin',
      platform: 'linkedin',
      access_token: process.env.LINKEDIN_ACCESS_TOKEN,
      refresh_token: '',
      token_expires_at: '2099-01-01T00:00:00Z',
      profile_id: process.env.LINKEDIN_PERSON_ID,
      profile_name: 'DropFly',
      profile_handle: 'dropfly',
      status: 'active',
      metadata: process.env.LINKEDIN_ORG_ID ? { organization_id: process.env.LINKEDIN_ORG_ID } : undefined,
    }
  }

  return null
}

// Publish to multiple platforms at once
export async function publishToMultiplePlatforms(
  userId: string,
  text: string,
  platforms: Platform[],
  mediaUrls?: string[],
  mediaType?: 'image' | 'video' | 'carousel'
): Promise<PublishResult[]> {
  const supabase = getServiceClient()

  // Get all connected platforms for user
  const { data: connections, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('user_id', userId)
    .in('platform', platforms)
    .eq('status', 'active')

  if (error) throw new Error(`Failed to get platform connections: ${error.message}`)

  // Build final connection list, using env fallbacks for missing platforms
  const connMap = new Map<Platform, PlatformConnection>()
  for (const conn of (connections || []) as PlatformConnection[]) {
    connMap.set(conn.platform, conn)
  }
  for (const p of platforms) {
    if (!connMap.has(p)) {
      const envConn = getEnvConnection(p)
      if (envConn) connMap.set(p, envConn)
    }
  }

  if (connMap.size === 0) throw new Error('No active platform connections found')

  // Publish to each platform in parallel
  const results = await Promise.all(
    Array.from(connMap.values()).map((conn) =>
      publishToplatform(conn, {
        platform: conn.platform,
        text,
        mediaUrls,
        mediaType,
      })
    )
  )

  return results
}
