// Instagram Graph API via Meta Business Suite
// Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

export interface InstagramTokens {
  access_token: string
  expires_at: number
  instagram_business_account_id: string
  page_id: string
}

export interface InstagramProfile {
  id: string
  username: string
  name: string
  profile_picture_url?: string
  followers_count: number
}

export interface InstagramPostResult {
  id: string
}

// Step 1: Get Facebook OAuth URL
export function getInstagramAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/instagram`,
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management',
    response_type: 'code',
    state,
  })

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
}

// Step 2: Exchange code for short-lived token, then get long-lived token
export async function exchangeInstagramCode(code: string): Promise<InstagramTokens> {
  // Get short-lived token
  const tokenRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/instagram`,
    code,
  })}`)

  if (!tokenRes.ok) {
    const error = await tokenRes.text()
    throw new Error(`Meta token exchange failed: ${error}`)
  }

  const { access_token: shortToken } = await tokenRes.json()

  // Exchange for long-lived token (60 days)
  const longRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  })}`)

  if (!longRes.ok) throw new Error('Failed to get long-lived token')
  const longData = await longRes.json()

  // Find Instagram Business Account linked to Facebook Page
  const pagesRes = await fetch(
    `${GRAPH_API_BASE}/me/accounts?fields=id,name,instagram_business_account&access_token=${longData.access_token}`
  )

  if (!pagesRes.ok) throw new Error('Failed to get Facebook pages')
  const pagesData = await pagesRes.json()

  const pageWithIg = pagesData.data?.find(
    (p: { instagram_business_account?: { id: string } }) => p.instagram_business_account
  )

  if (!pageWithIg?.instagram_business_account) {
    throw new Error('No Instagram Business Account found. Make sure your Instagram account is connected to a Facebook Page as a Business or Creator account.')
  }

  return {
    access_token: longData.access_token,
    expires_at: Date.now() + (longData.expires_in || 5184000) * 1000,
    instagram_business_account_id: pageWithIg.instagram_business_account.id,
    page_id: pageWithIg.id,
  }
}

export async function refreshInstagramToken(
  accessToken: string
): Promise<{ access_token: string; expires_at: number }> {
  const res = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: accessToken,
    })}`
  )

  if (!res.ok) throw new Error('Failed to refresh Instagram token')
  const data = await res.json()

  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 5184000) * 1000,
  }
}

export async function getInstagramProfile(
  accessToken: string,
  igAccountId: string
): Promise<InstagramProfile> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${igAccountId}?fields=id,username,name,profile_picture_url,followers_count&access_token=${accessToken}`
  )

  if (!res.ok) throw new Error('Failed to get Instagram profile')
  return res.json()
}

// Post a single image
export async function postInstagramImage(
  accessToken: string,
  igAccountId: string,
  imageUrl: string,
  caption: string
): Promise<InstagramPostResult> {
  // Step 1: Create media container
  const containerRes = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  })

  if (!containerRes.ok) {
    const error = await containerRes.text()
    throw new Error(`Instagram media container creation failed: ${error}`)
  }

  const { id: containerId } = await containerRes.json()

  // Step 2: Wait for container to be ready, then publish
  await waitForMediaReady(accessToken, containerId)

  const publishRes = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  })

  if (!publishRes.ok) {
    const error = await publishRes.text()
    throw new Error(`Instagram publish failed: ${error}`)
  }

  return publishRes.json()
}

// Post a video (Reel)
export async function postInstagramReel(
  accessToken: string,
  igAccountId: string,
  videoUrl: string,
  caption: string
): Promise<InstagramPostResult> {
  // Step 1: Create video container
  const containerRes = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      access_token: accessToken,
    }),
  })

  if (!containerRes.ok) {
    const error = await containerRes.text()
    throw new Error(`Instagram reel container creation failed: ${error}`)
  }

  const { id: containerId } = await containerRes.json()

  // Step 2: Poll until video is ready (can take a while)
  await waitForMediaReady(accessToken, containerId, 60)

  // Step 3: Publish
  const publishRes = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  })

  if (!publishRes.ok) {
    const error = await publishRes.text()
    throw new Error(`Instagram reel publish failed: ${error}`)
  }

  return publishRes.json()
}

// Post a carousel (multiple images)
export async function postInstagramCarousel(
  accessToken: string,
  igAccountId: string,
  imageUrls: string[],
  caption: string
): Promise<InstagramPostResult> {
  // Step 1: Create individual media containers for each image
  const childIds: string[] = []
  for (const url of imageUrls) {
    const res = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: url,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    })

    if (!res.ok) throw new Error('Failed to create carousel item')
    const { id } = await res.json()
    childIds.push(id)
  }

  // Step 2: Create carousel container
  const carouselRes = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds,
      caption,
      access_token: accessToken,
    }),
  })

  if (!carouselRes.ok) throw new Error('Failed to create carousel container')
  const { id: carouselId } = await carouselRes.json()

  await waitForMediaReady(accessToken, carouselId)

  // Step 3: Publish
  const publishRes = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: carouselId,
      access_token: accessToken,
    }),
  })

  if (!publishRes.ok) throw new Error('Failed to publish carousel')
  return publishRes.json()
}

// Get post-level insights (engagement metrics)
export async function getInstagramMediaInsights(
  accessToken: string,
  mediaId: string
): Promise<{ impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number }> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${mediaId}/insights?metric=impressions,reach,likes,comments,shares,saved&access_token=${accessToken}`
  )

  if (!res.ok) {
    // Fallback to basic fields if insights API fails (e.g. story or album child)
    const basicRes = await fetch(
      `${GRAPH_API_BASE}/${mediaId}?fields=like_count,comments_count&access_token=${accessToken}`
    )
    if (basicRes.ok) {
      const basic = await basicRes.json()
      return {
        impressions: 0,
        reach: 0,
        likes: basic.like_count || 0,
        comments: basic.comments_count || 0,
        shares: 0,
        saves: 0,
      }
    }
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
  }

  const data = await res.json()
  const metrics: Record<string, number> = {}
  for (const item of (data.data || [])) {
    metrics[item.name] = item.values?.[0]?.value ?? 0
  }

  return {
    impressions: metrics.impressions || 0,
    reach: metrics.reach || 0,
    likes: metrics.likes || 0,
    comments: metrics.comments || 0,
    shares: metrics.shares || 0,
    saves: metrics.saved || 0,
  }
}

// Poll media container until it's ready
async function waitForMediaReady(
  accessToken: string,
  containerId: string,
  maxAttempts = 30
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    )
    const data = await res.json()

    if (data.status_code === 'FINISHED') return
    if (data.status_code === 'ERROR') {
      throw new Error(`Instagram media processing failed: ${JSON.stringify(data)}`)
    }

    // Wait 2 seconds between polls
    await new Promise((r) => setTimeout(r, 2000))
  }

  throw new Error('Instagram media processing timed out')
}
