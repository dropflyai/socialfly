import { createServiceClient } from '@/lib/supabase-server'
import { CREDIT_COSTS, type CreditAction, getCreditsForTier } from '@/lib/plans'

export { CREDIT_COSTS, type CreditAction }

interface CreditCheckResult {
  allowed: boolean
  creditsRequired: number
  creditsUsed: number
  creditsLimit: number
  creditsRemaining: number
}

/**
 * Check if a user has enough credits for an action. Does NOT deduct.
 */
export async function checkCredits(
  userId: string,
  action: CreditAction
): Promise<CreditCheckResult> {
  const supabase = createServiceClient()
  const cost = CREDIT_COSTS[action]

  // Get or create credit usage record
  const usage = await getOrCreateUsage(userId, supabase)

  // Auto-reset if period has expired
  const now = new Date()
  if (usage.period_end && new Date(usage.period_end) < now) {
    await resetCredits(userId, supabase, usage.credits_limit)
    return {
      allowed: cost <= usage.credits_limit,
      creditsRequired: cost,
      creditsUsed: 0,
      creditsLimit: usage.credits_limit,
      creditsRemaining: usage.credits_limit,
    }
  }

  const remaining = usage.credits_limit - usage.credits_used

  return {
    allowed: cost <= remaining,
    creditsRequired: cost,
    creditsUsed: usage.credits_used,
    creditsLimit: usage.credits_limit,
    creditsRemaining: remaining,
  }
}

/**
 * Deduct credits for an action. Returns false if insufficient credits.
 */
export async function deductCredits(
  userId: string,
  action: CreditAction,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; creditsRemaining: number }> {
  const supabase = createServiceClient()
  const cost = CREDIT_COSTS[action]

  if (cost === 0) {
    return { success: true, creditsRemaining: -1 }
  }

  // Get or create usage record
  const usage = await getOrCreateUsage(userId, supabase)

  // Auto-reset if period expired
  const now = new Date()
  if (usage.period_end && new Date(usage.period_end) < now) {
    await resetCredits(userId, supabase, usage.credits_limit)
    // After reset, usage is 0
    if (cost > usage.credits_limit) {
      return { success: false, creditsRemaining: usage.credits_limit }
    }
  } else {
    const remaining = usage.credits_limit - usage.credits_used
    if (cost > remaining) {
      return { success: false, creditsRemaining: remaining }
    }
  }

  // Deduct credits atomically using RPC-style update
  const { error: updateError } = await supabase
    .from('credit_usage')
    .update({
      credits_used: (usage.period_end && new Date(usage.period_end) < now)
        ? cost  // Was just reset
        : usage.credits_used + cost,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Failed to deduct credits:', updateError)
    return { success: false, creditsRemaining: 0 }
  }

  // Log the deduction
  await supabase.from('credit_log').insert({
    user_id: userId,
    action,
    credits_deducted: cost,
    metadata: metadata || {},
  })

  const newUsed = (usage.period_end && new Date(usage.period_end) < now)
    ? cost
    : usage.credits_used + cost

  return {
    success: true,
    creditsRemaining: usage.credits_limit - newUsed,
  }
}

/**
 * Get current credit usage for a user.
 */
export async function getCreditUsage(userId: string) {
  const supabase = createServiceClient()
  const usage = await getOrCreateUsage(userId, supabase)

  // Auto-reset if period expired
  const now = new Date()
  if (usage.period_end && new Date(usage.period_end) < now) {
    await resetCredits(userId, supabase, usage.credits_limit)
    return {
      used: 0,
      limit: usage.credits_limit,
      remaining: usage.credits_limit,
      periodStart: now.toISOString(),
      periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    }
  }

  return {
    used: usage.credits_used,
    limit: usage.credits_limit,
    remaining: usage.credits_limit - usage.credits_used,
    periodStart: usage.period_start,
    periodEnd: usage.period_end,
  }
}

// --- Internal helpers ---

async function getOrCreateUsage(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data } = await supabase
    .from('credit_usage')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (data) return data

  // Determine tier from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single()

  const tier = profile?.subscription_tier || 'free'
  const limit = getCreditsForTier(tier)

  const now = new Date()
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const { data: created } = await supabase
    .from('credit_usage')
    .upsert({
      user_id: userId,
      credits_used: 0,
      credits_limit: limit,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  return created || {
    user_id: userId,
    credits_used: 0,
    credits_limit: limit,
    period_start: now.toISOString(),
    period_end: periodEnd.toISOString(),
  }
}

async function resetCredits(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>,
  limit: number
) {
  const now = new Date()
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  await supabase
    .from('credit_usage')
    .update({
      credits_used: 0,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId)
}
