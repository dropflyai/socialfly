import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

// POST /api/automations/feedback — store rejection feedback
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ruleId, rejectedText, issues, suggestion } = await request.json()

  if (!ruleId || !rejectedText || !issues?.length) {
    return NextResponse.json({ error: 'ruleId, rejectedText, and issues are required' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('automation_feedback')
    .insert({
      user_id: user.id,
      rule_id: ruleId,
      rejected_text: rejectedText,
      issues,
      suggestion: suggestion || null,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// GET /api/automations/feedback?ruleId=xxx — get feedback for a rule
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ruleId = searchParams.get('ruleId')
  if (!ruleId) return NextResponse.json({ error: 'Missing ruleId' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('automation_feedback')
    .select('*')
    .eq('user_id', user.id)
    .eq('rule_id', ruleId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ feedback: data || [] })
}
