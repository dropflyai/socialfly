import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

// GET /api/posts/schedule — list scheduled posts for user
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'scheduled'

  const serviceClient = createServiceClient()
  const { data: posts, error } = await serviceClient
    .from('scheduled_posts')
    .select('*, content_items(*)')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ posts })
}

// PATCH /api/posts/schedule?id=xxx&action=approve — approve a draft post
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('id')
  const action = searchParams.get('action')

  if (!postId) {
    return NextResponse.json({ error: 'Missing post ID' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  if (action === 'approve') {
    // Move draft to scheduled, publish in 5 minutes
    const { error } = await serviceClient
      .from('scheduled_posts')
      .update({
        status: 'scheduled',
        scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', user.id)
      .eq('status', 'draft')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status: 'scheduled' })
  }

  if (action === 'edit') {
    // Update the draft text
    const body = await request.json()
    const { text } = body

    // Get current custom_content and merge the new text
    const { data: post } = await serviceClient
      .from('scheduled_posts')
      .select('custom_content')
      .eq('id', postId)
      .eq('user_id', user.id)
      .single()

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const updatedContent = { ...(post.custom_content as Record<string, unknown>), text }

    const { error } = await serviceClient
      .from('scheduled_posts')
      .update({
        custom_content: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// DELETE /api/posts/schedule?id=xxx — cancel a scheduled post
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('id')

  if (!postId) {
    return NextResponse.json({ error: 'Missing post ID' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('scheduled_posts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', user.id)
    .in('status', ['scheduled', 'draft'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
