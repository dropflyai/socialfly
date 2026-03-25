import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

// GET /api/campaigns — list user's campaigns
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const serviceClient = createServiceClient()
  let query = serviceClient
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For each campaign, get post count
  const campaigns = await Promise.all(
    (data || []).map(async (campaign: { id: string; [key: string]: unknown }) => {
      const { count } = await serviceClient
        .from('scheduled_posts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('user_id', user.id)

      return { ...campaign, post_count: count || 0 }
    })
  )

  return NextResponse.json({ campaigns })
}

// POST /api/campaigns — create a new campaign
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, platforms, startDate, endDate, status: campaignStatus } = body

  if (!name) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('campaigns')
    .insert({
      user_id: user.id,
      name,
      description: description || null,
      platforms: platforms || [],
      start_date: startDate || new Date().toISOString().split('T')[0],
      end_date: endDate || null,
      status: campaignStatus || 'active',
      post_ids: [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ campaign: data })
}

// PATCH /api/campaigns — update a campaign
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })

  const serviceClient = createServiceClient()
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.status) updateData.status = updates.status
  if (updates.endDate) updateData.end_date = updates.endDate

  const { data, error } = await serviceClient
    .from('campaigns')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ campaign: data })
}

// DELETE /api/campaigns?id=xxx
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
