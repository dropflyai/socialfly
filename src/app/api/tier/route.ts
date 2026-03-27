import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUserTier } from '@/lib/tier-gates'

// GET /api/tier — returns user's tier and feature access map
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tier, plan } = await getUserTier(user.id)

  const proFeatures = ['pro', 'agency'].includes(tier)
  const creatorFeatures = ['creator', 'pro', 'agency'].includes(tier)

  return NextResponse.json({
    tier,
    plan: {
      id: plan.id,
      name: plan.name,
      credits: plan.credits,
      brands: plan.brands,
      platforms: plan.platforms,
      scheduledPosts: plan.scheduledPosts,
      teamMembers: plan.teamMembers,
    },
    features: {
      content_calendar: creatorFeatures,
      autopilot: proFeatures,
      advanced_analytics: proFeatures,
      video_generation: proFeatures,
      priority_support: tier === 'agency',
    },
  })
}
