import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSubscription, getPlanByPriceId } from '@/lib/stripe'
import { PLANS } from '@/lib/plans'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get subscription from database
    const subscription = await getSubscription(user.id)

    // Get credit usage
    const { data: creditData } = await supabase
      .from('credit_usage')
      .select('credits_used, credits_limit')
      .eq('user_id', user.id)
      .single()

    // Get profile tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const tier = profile?.subscription_tier || 'free'
    const plan = getPlanByPriceId(subscription?.stripe_price_id || '') || PLANS.find((p) => p.id === tier) || PLANS[0]

    return NextResponse.json({
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            priceId: subscription.stripe_price_id,
            currentPeriodEnd: subscription.current_period_end,
            currentPeriodStart: subscription.current_period_start,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          }
        : null,
      plan: {
        id: plan.id,
        name: plan.name,
        credits: plan.credits,
      },
      credits: {
        used: creditData?.credits_used ?? 0,
        limit: creditData?.credits_limit ?? plan.credits,
      },
      tier,
    })
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}
