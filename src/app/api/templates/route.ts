import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

// GET /api/templates — list user's content templates
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')

  const serviceClient = createServiceClient()
  let query = serviceClient
    .from('content_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('usage_count', { ascending: false })
    .limit(50)

  if (platform && platform !== 'all') query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ templates: data || [] })
}

// POST /api/templates — create a new template
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, platform, contentType, template, tags } = body

  if (!name || !platform || !template) {
    return NextResponse.json({ error: 'Name, platform, and template are required' }, { status: 400 })
  }

  // Extract {{variables}} from template
  const variableMatches = template.match(/\{\{(\w+)\}\}/g) || []
  const variables = [...new Set(variableMatches.map((v: string) => v.replace(/\{\{|\}\}/g, '')))]

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('content_templates')
    .insert({
      user_id: user.id,
      name,
      description: description || null,
      platform,
      content_type: contentType || 'text',
      template,
      variables,
      tags: tags || [],
      usage_count: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ template: data })
}

// DELETE /api/templates?id=xxx
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Template ID required' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('content_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
