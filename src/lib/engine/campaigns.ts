/**
 * Campaign Management
 *
 * Group posts by campaign, track campaign-level performance,
 * and manage campaign lifecycle.
 */

import { getSupabase } from './config'
import type { Platform, CampaignRecord, CampaignMetrics } from './types'

interface CreateCampaignOptions {
  userId: string
  name: string
  description?: string
  platforms: Platform[]
  startDate?: string
  endDate?: string
}

/**
 * Create a new campaign.
 */
export async function createCampaign(
  options: CreateCampaignOptions
): Promise<CampaignRecord> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: options.userId,
      name: options.name,
      description: options.description || null,
      platforms: options.platforms,
      start_date: options.startDate || new Date().toISOString().split('T')[0],
      end_date: options.endDate || null,
      status: 'active',
      post_ids: [],
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create campaign: ${error.message}`)
  return mapCampaignRecord(data)
}

/**
 * List campaigns for a user.
 */
export async function listCampaigns(
  userId: string,
  options?: { status?: string; limit?: number }
): Promise<CampaignRecord[]> {
  const supabase = getSupabase()

  let query = supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 20)

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to list campaigns: ${error.message}`)
  return (data || []).map(mapCampaignRecord)
}

/**
 * Get a single campaign by ID.
 */
export async function getCampaign(
  userId: string,
  campaignId: string
): Promise<CampaignRecord> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`Campaign not found: ${error.message}`)
  return mapCampaignRecord(data)
}

/**
 * Update campaign details or status.
 */
export async function updateCampaign(
  userId: string,
  campaignId: string,
  updates: Partial<Pick<CampaignRecord, 'name' | 'description' | 'status' | 'endDate'>>
): Promise<CampaignRecord> {
  const supabase = getSupabase()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.status) updateData.status = updates.status
  if (updates.endDate) updateData.end_date = updates.endDate

  const { data, error } = await supabase
    .from('campaigns')
    .update(updateData)
    .eq('id', campaignId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update campaign: ${error.message}`)
  return mapCampaignRecord(data)
}

/**
 * Add a post to a campaign.
 */
export async function addPostToCampaign(
  userId: string,
  campaignId: string,
  postId: string
): Promise<void> {
  const supabase = getSupabase()

  // Get current post_ids
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('post_ids')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single()

  if (!campaign) throw new Error('Campaign not found')

  const postIds = (campaign.post_ids || []) as string[]
  if (!postIds.includes(postId)) {
    postIds.push(postId)
    await supabase
      .from('campaigns')
      .update({ post_ids: postIds, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
  }

  // Also tag the post with the campaign ID
  await supabase
    .from('scheduled_posts')
    .update({ campaign_id: campaignId })
    .eq('id', postId)
    .eq('user_id', userId)
}

/**
 * Get campaign metrics by aggregating post performance.
 */
export async function getCampaignMetrics(
  userId: string,
  campaignId: string
): Promise<CampaignMetrics> {
  const supabase = getSupabase()

  // Get all posts in this campaign
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('metrics, status')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)

  if (error) throw new Error(`Failed to get campaign metrics: ${error.message}`)

  let totalPosts = 0
  let totalImpressions = 0
  let totalEngagements = 0
  let totalClicks = 0

  for (const post of (posts || [])) {
    if (post.status === 'posted') totalPosts++

    const metrics = post.metrics as Record<string, { impressions?: number; engagements?: number; clicks?: number; likes?: number; comments?: number; shares?: number }> | null
    if (metrics) {
      for (const platformMetrics of Object.values(metrics)) {
        totalImpressions += platformMetrics.impressions || 0
        totalEngagements += platformMetrics.engagements || (platformMetrics.likes || 0) + (platformMetrics.comments || 0) + (platformMetrics.shares || 0)
        totalClicks += platformMetrics.clicks || 0
      }
    }
  }

  return {
    totalPosts,
    totalImpressions,
    totalEngagements,
    totalClicks,
    avgEngagementRate: totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCampaignRecord(row: any): CampaignRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    status: row.status,
    platforms: row.platforms || [],
    startDate: row.start_date,
    endDate: row.end_date || undefined,
    postIds: row.post_ids || [],
    createdAt: row.created_at,
  }
}
