import { NextResponse } from 'next/server'
import crypto from 'crypto'

const USER_ID = process.env.SOCIALFLY_USER_ID || 'f01c5db3-9969-4b30-8fb4-af7b58b0dfe3'

export async function GET() {
  const state = Buffer.from(JSON.stringify({
    userId: USER_ID,
    nonce: crypto.randomBytes(16).toString('hex'),
  })).toString('base64url')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/linkedin`,
    scope: 'openid profile w_member_social',
    state,
  })

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
