/**
 * Tier-based feature gating for SocialFly.
 * Checks if a user's subscription tier allows a given action.
 */

import { createServiceClient } from '@/lib/supabase-server'
import { getPlanById, type Plan } from '@/lib/plans'

export type Feature =
  | 'content_calendar'
  | 'autopilot'
  | 'advanced_analytics'
  | 'video_generation'
  | 'priority_support'

// Features that require a minimum tier
const FEATURE_MIN_TIER: Record<Feature, string[]> = {
  content_calendar: ['creator', 'pro', 'agency'],
  autopilot: ['pro', 'agency'],
  advanced_analytics: ['pro', 'agency'],
  video_generation: ['pro', 'agency'],
  priority_support: ['agency'],
}

export interface TierCheckResult {
  allowed: boolean
  currentTier: string
  currentPlan: Plan
  reason?: string
  upgradeRequired?: string // minimum tier needed
}

/**
 * Get the user's current tier and plan.
 */
export async function getUserTier(userId: string): Promise<{ tier: string; plan: Plan }> {
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single()

  const tier = profile?.subscription_tier || 'free'
  const plan = getPlanById(tier) || getPlanById('free')!
  return { tier, plan }
}

/**
 * Check if a user can access a feature.
 */
export async function checkFeatureAccess(
  userId: string,
  feature: Feature
): Promise<TierCheckResult> {
  const { tier, plan } = await getUserTier(userId)
  const allowedTiers = FEATURE_MIN_TIER[feature]

  if (allowedTiers.includes(tier)) {
    return { allowed: true, currentTier: tier, currentPlan: plan }
  }

  return {
    allowed: false,
    currentTier: tier,
    currentPlan: plan,
    reason: `${feature.replace(/_/g, ' ')} requires a ${allowedTiers[0]} plan or higher.`,
    upgradeRequired: allowedTiers[0],
  }
}

/**
 * Check if a user can create another brand profile.
 */
export async function checkBrandLimit(userId: string): Promise<TierCheckResult> {
  const { tier, plan } = await getUserTier(userId)
  const supabase = createServiceClient()

  if (plan.brands === 'unlimited') {
    return { allowed: true, currentTier: tier, currentPlan: plan }
  }

  const { count } = await supabase
    .from('brand_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const currentCount = count || 0
  const limit = plan.brands as number

  if (currentCount >= limit) {
    return {
      allowed: false,
      currentTier: tier,
      currentPlan: plan,
      reason: `Your ${plan.name} plan allows ${limit} brand profile${limit === 1 ? '' : 's'}. Upgrade to add more.`,
      upgradeRequired: tier === 'free' ? 'creator' : tier === 'creator' ? 'pro' : 'agency',
    }
  }

  return { allowed: true, currentTier: tier, currentPlan: plan }
}

/**
 * Check if a user can connect another platform.
 */
export async function checkPlatformLimit(userId: string): Promise<TierCheckResult> {
  const { tier, plan } = await getUserTier(userId)
  const supabase = createServiceClient()

  const { count } = await supabase
    .from('platform_connections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')

  const currentCount = count || 0
  const limit = plan.platforms

  if (currentCount >= limit) {
    return {
      allowed: false,
      currentTier: tier,
      currentPlan: plan,
      reason: `Your ${plan.name} plan allows ${limit} platform connection${limit === 1 ? '' : 's'}. Upgrade to connect more.`,
      upgradeRequired: tier === 'free' ? 'creator' : 'pro',
    }
  }

  return { allowed: true, currentTier: tier, currentPlan: plan }
}

/**
 * Check if a user can schedule another post.
 */
export async function checkScheduleLimit(userId: string): Promise<TierCheckResult> {
  const { tier, plan } = await getUserTier(userId)

  if (plan.scheduledPosts === 'unlimited') {
    return { allowed: true, currentTier: tier, currentPlan: plan }
  }

  const supabase = createServiceClient()
  const { count } = await supabase
    .from('scheduled_posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'scheduled')

  const currentCount = count || 0
  const limit = plan.scheduledPosts as number

  if (currentCount >= limit) {
    return {
      allowed: false,
      currentTier: tier,
      currentPlan: plan,
      reason: `Your ${plan.name} plan allows ${limit} scheduled post${limit === 1 ? '' : 's'}. Upgrade for more.`,
      upgradeRequired: tier === 'free' ? 'creator' : 'pro',
    }
  }

  return { allowed: true, currentTier: tier, currentPlan: plan }
}
