// LinkedIn Marketing API
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares
// Uses OAuth 2.0 three-legged flow + Organization Posts API

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'
const LINKEDIN_REST_BASE = 'https://api.linkedin.com/rest'

export interface LinkedInTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  organization_id?: string
}

export interface LinkedInProfile {
  id: string
  localizedFirstName: string
  localizedLastName: string
  profilePicture?: string
}

export interface LinkedInPostResult {
  id: string
}

// OAuth 2.0 flow for LinkedIn
export function getLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/linkedin`,
    scope: 'openid profile w_member_social',
    state,
  })

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

export async function exchangeLinkedInCode(code: string): Promise<LinkedInTokens> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/linkedin`,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`LinkedIn token exchange failed: ${error}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || '',
    expires_at: Date.now() + (data.expires_in || 5184000) * 1000,
  }
}

export async function refreshLinkedInToken(
  refreshToken: string
): Promise<LinkedInTokens> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) throw new Error('Failed to refresh LinkedIn token')
  const data = await res.json()

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + (data.expires_in || 5184000) * 1000,
  }
}

export async function getLinkedInProfile(
  accessToken: string
): Promise<LinkedInProfile> {
  const res = await fetch(`${LINKEDIN_API_BASE}/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error('Failed to get LinkedIn profile')
  return res.json()
}

// Post text to LinkedIn as a person
export async function postLinkedInText(
  accessToken: string,
  authorUrn: string,
  text: string
): Promise<LinkedInPostResult> {
  const res = await fetch(`${LINKEDIN_REST_BASE}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`LinkedIn text post failed: ${error}`)
  }

  const postId = res.headers.get('x-restli-id') || ''
  return { id: postId }
}

// Post image to LinkedIn
export async function postLinkedInImage(
  accessToken: string,
  authorUrn: string,
  imageUrl: string,
  text: string
): Promise<LinkedInPostResult> {
  // Step 1: Initialize image upload
  const initRes = await fetch(`${LINKEDIN_REST_BASE}/images?action=initializeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn,
      },
    }),
  })

  if (!initRes.ok) {
    const error = await initRes.text()
    throw new Error(`LinkedIn image upload init failed: ${error}`)
  }

  const initData = await initRes.json()
  const uploadUrl = initData.value.uploadUrl
  const imageUrn = initData.value.image

  // Step 2: Download the image and upload to LinkedIn
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) throw new Error('Failed to download image for LinkedIn upload')
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  })

  if (!uploadRes.ok) {
    const error = await uploadRes.text()
    throw new Error(`LinkedIn image upload failed: ${error}`)
  }

  // Step 3: Create post with image
  const postRes = await fetch(`${LINKEDIN_REST_BASE}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          title: 'Image',
          id: imageUrn,
        },
      },
      lifecycleState: 'PUBLISHED',
    }),
  })

  if (!postRes.ok) {
    const error = await postRes.text()
    throw new Error(`LinkedIn image post failed: ${error}`)
  }

  const postId = postRes.headers.get('x-restli-id') || ''
  return { id: postId }
}

// Post article/link to LinkedIn
export async function postLinkedInArticle(
  accessToken: string,
  authorUrn: string,
  articleUrl: string,
  text: string,
  title?: string
): Promise<LinkedInPostResult> {
  const res = await fetch(`${LINKEDIN_REST_BASE}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        article: {
          source: articleUrl,
          title: title || '',
        },
      },
      lifecycleState: 'PUBLISHED',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`LinkedIn article post failed: ${error}`)
  }

  const postId = res.headers.get('x-restli-id') || ''
  return { id: postId }
}

// Get organization follower statistics
export async function getLinkedInOrgStats(
  accessToken: string,
  organizationId: string
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${LINKEDIN_API_BASE}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${organizationId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  )

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`LinkedIn org stats failed: ${error}`)
  }

  return res.json()
}

// Get post-level analytics
export async function getLinkedInPostAnalytics(
  accessToken: string,
  postUrns: string[]
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${LINKEDIN_REST_BASE}/socialMetadata?ids=List(${postUrns.map(u => encodeURIComponent(u)).join(',')})`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401',
      },
    }
  )

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`LinkedIn post analytics failed: ${error}`)
  }

  const data = await res.json()
  return data.results ? Object.values(data.results) : []
}
