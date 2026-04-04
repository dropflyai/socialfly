import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { checkFeatureAccess } from '@/lib/tier-gates'

// GET /api/automations — list automation rules
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // active, paused, or null for all

  const serviceClient = createServiceClient()
  let query = serviceClient
    .from('automation_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'paused') {
    query = query.eq('is_active', false)
  }

  const { data: rules, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Map DB columns to frontend expected shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (rules || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    brand_id: r.brand_id,
    type: r.trigger_config?.originalType || r.trigger_type,
    config: r.trigger_config || {},
    platforms: r.action_config?.platforms || [],
    schedule: r.trigger_config?.schedule || 'daily',
    status: r.is_active ? 'active' : 'paused',
    last_run: r.last_triggered_at,
    run_count: r.trigger_count || 0,
    created_at: r.created_at,
    is_campaign: r.is_campaign || false,
    campaign_start: r.campaign_start,
    campaign_end: r.campaign_end,
    campaign_goal: r.campaign_goal,
    campaign_goal_target: r.campaign_goal_target,
  }))

  return NextResponse.json({ rules: mapped })
}

// POST /api/automations — create a new automation rule
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Autopilot requires Pro or higher
  const featureCheck = await checkFeatureAccess(user.id, 'autopilot')
  if (!featureCheck.allowed) {
    return NextResponse.json(
      { error: featureCheck.reason, upgradeRequired: featureCheck.upgradeRequired },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { name, type, config, actionType, actionConfig, description, platforms, schedule, brandId, isCampaign, campaignStart, campaignEnd, campaignGoal, campaignGoalTarget } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'Missing name or type' }, { status: 400 })
  }

  // Map frontend automation types to valid DB trigger/action types
  const triggerType = type === 'repurpose' ? 'content_ready' : 'schedule'
  const actionTypeResolved = type === 'repurpose' ? 'repurpose'
    : actionType || 'generate_content'

  const serviceClient = createServiceClient()
  const { data: rule, error } = await serviceClient
    .from('automation_rules')
    .insert({
      user_id: user.id,
      brand_id: brandId || null,
      name,
      description: description || null,
      trigger_type: triggerType,
      trigger_config: { ...(config || {}), schedule: schedule || 'daily', originalType: type },
      action_type: actionTypeResolved,
      action_config: { ...(actionConfig || {}), platforms: platforms || ['instagram'] },
      is_active: true,
      next_trigger_at: isCampaign && campaignStart
        ? new Date(campaignStart).toISOString()
        : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      trigger_count: 0,
      success_count: 0,
      failure_count: 0,
      is_campaign: isCampaign || false,
      campaign_start: campaignStart || null,
      campaign_end: campaignEnd || null,
      campaign_goal: campaignGoal || null,
      campaign_goal_target: campaignGoalTarget || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rule })
}

// PATCH /api/automations?id=xxx — update rule status
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ruleId = searchParams.get('id')
  if (!ruleId) {
    return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 })
  }

  const body = await request.json()
  const serviceClient = createServiceClient()

  // Map frontend fields to DB columns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.status !== undefined) updateData.is_active = body.status === 'active'
  if (body.is_active !== undefined) updateData.is_active = body.is_active
  if (body.type !== undefined) updateData.trigger_type = body.type
  if (body.config !== undefined) {
    updateData.trigger_config = {
      ...body.config,
      schedule: body.schedule || body.config.schedule,
      originalType: body.config.originalType || body.type,
    }
  }
  if (body.schedule !== undefined && !body.config) {
    // Update schedule inside existing trigger_config
    updateData.trigger_config = updateData.trigger_config || {}
    updateData.trigger_config.schedule = body.schedule
  }
  if (body.platforms !== undefined) {
    updateData.action_config = { platforms: body.platforms }
  }
  if (body.actionType !== undefined) updateData.action_type = body.actionType
  if (body.actionConfig !== undefined) updateData.action_config = body.actionConfig
  if (body.brandId !== undefined) updateData.brand_id = body.brandId || null
  if (body.isCampaign !== undefined) updateData.is_campaign = body.isCampaign
  if (body.campaignStart !== undefined) updateData.campaign_start = body.campaignStart || null
  if (body.campaignEnd !== undefined) updateData.campaign_end = body.campaignEnd || null
  if (body.campaignGoal !== undefined) updateData.campaign_goal = body.campaignGoal || null
  if (body.campaignGoalTarget !== undefined) updateData.campaign_goal_target = body.campaignGoalTarget || null
  if (body.runNow === true) {
    updateData.next_trigger_at = new Date().toISOString()
    updateData.last_triggered_at = null // Reset so isDue returns true
  }

  const { error } = await serviceClient
    .from('automation_rules')
    .update(updateData)
    .eq('id', ruleId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/automations?id=xxx — delete a rule
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ruleId = searchParams.get('id')
  if (!ruleId) {
    return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('automation_rules')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
