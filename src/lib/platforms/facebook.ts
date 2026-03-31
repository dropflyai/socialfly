// Facebook Pages API via Meta Graph API
// Docs: https://developers.facebook.com/docs/pages-api
// Uses the same Meta Graph API as Instagram but targets Facebook Pages directly

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

export interface FacebookTokens {
  access_token: string
  expires_at: number
  page_id: string
  page_name: string
}

export interface FacebookProfile {
  id: string
  name: string
  picture?: { data: { url: string } }
  followers_count: number
  fan_count: number
}

export interface FacebookPostResult {
  id: string
}

// Step 1: Get Facebook OAuth URL (Pages permissions)
export function getFacebookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/facebook`,
    scope: 'pages_manage_posts,pages_read_engagement,pages_show_list,business_management',
    response_type: 'code',
    state,
  })

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
}

// Step 2: Exchange code for page access token
export async function exchangeFacebookCode(code: string): Promise<FacebookTokens> {
  // Get user access token
  const tokenRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/facebook`,
    code,
  })}`)

  if (!tokenRes.ok) {
    const error = await tokenRes.text()
    throw new Error(`Facebook token exchange failed: ${error}`)
  }

  const { access_token: userToken } = await tokenRes.json()

  // Exchange for long-lived user token
  const longRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: userToken,
  })}`)

  if (!longRes.ok) throw new Error('Failed to get long-lived Facebook token')
  const longData = await longRes.json()

  // Get pages the user manages
  const pagesRes = await fetch(
    `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token&access_token=${longData.access_token}`
  )

  if (!pagesRes.ok) throw new Error('Failed to get Facebook pages')
  const pagesData = await pagesRes.json()

  const page = pagesData.data?.[0]
  if (!page) {
    throw new Error('No Facebook Page found. Make sure you manage at least one Facebook Page.')
  }

  // Page access tokens from long-lived user tokens don't expire
  return {
    access_token: page.access_token,
    expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000, // ~never expires
    page_id: page.id,
    page_name: page.name,
  }
}

export async function refreshFacebookToken(
  accessToken: string
): Promise<{ access_token: string; expires_at: number }> {
  // Page access tokens derived from long-lived user tokens don't expire
  // But we can refresh the underlying user token
  const res = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: accessToken,
    })}`
  )

  if (!res.ok) throw new Error('Failed to refresh Facebook token')
  const data = await res.json()

  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 5184000) * 1000,
  }
}

export async function getFacebookProfile(
  accessToken: string,
  pageId: string
): Promise<FacebookProfile> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${pageId}?fields=id,name,picture,followers_count,fan_count&access_token=${accessToken}`
  )

  if (!res.ok) throw new Error('Failed to get Facebook page profile')
  return res.json()
}

// Post text-only to a Facebook Page
export async function postFacebookText(
  accessToken: string,
  pageId: string,
  message: string
): Promise<FacebookPostResult> {
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      access_token: accessToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Facebook text post failed: ${error}`)
  }

  return res.json()
}

// Post a single image with caption to a Facebook Page
export async function postFacebookImage(
  accessToken: string,
  pageId: string,
  imageUrl: string,
  caption: string
): Promise<FacebookPostResult> {
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: imageUrl,
      message: caption,
      access_token: accessToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Facebook image post failed: ${error}`)
  }

  return res.json()
}

// Post a video to a Facebook Page
export async function postFacebookVideo(
  accessToken: string,
  pageId: string,
  videoUrl: string,
  description: string
): Promise<FacebookPostResult> {
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_url: videoUrl,
      description,
      access_token: accessToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Facebook video post failed: ${error}`)
  }

  return res.json()
}

// Post a link share to a Facebook Page
export async function postFacebookLink(
  accessToken: string,
  pageId: string,
  link: string,
  message?: string
): Promise<FacebookPostResult> {
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      link,
      message: message || '',
      access_token: accessToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Facebook link post failed: ${error}`)
  }

  return res.json()
}

// Get page insights (analytics)
export async function getFacebookPageInsights(
  accessToken: string,
  pageId: string,
  metrics: string[],
  period: 'day' | 'week' | 'days_28' = 'day',
  since?: string,
  until?: string
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    metric: metrics.join(','),
    period,
    access_token: accessToken,
  })

  if (since) params.set('since', since)
  if (until) params.set('until', until)

  const res = await fetch(
    `${GRAPH_API_BASE}/${pageId}/insights?${params.toString()}`
  )

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Facebook insights failed: ${error}`)
  }

  const data = await res.json()
  return data.data || []
}

// Get post-level insights
export async function getFacebookPostInsights(
  accessToken: string,
  postId: string,
  metrics: string[] = ['post_impressions', 'post_engagements', 'post_clicks', 'post_reactions_by_type_total']
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${postId}/insights?metric=${metrics.join(',')}&access_token=${accessToken}`
  )

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Facebook post insights failed: ${error}`)
  }

  const data = await res.json()
  return data.data || []
}
