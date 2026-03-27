import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase-server'
import { PLANS, type Plan } from '@/lib/plans'

export type { Plan }
export { PLANS, getPlanById, getCreditsForTier, getTokenLimitForTier } from '@/lib/plans'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  }
  return _stripe
}

// Convenience alias
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string]
  },
})

// Server-side plan lookup that resolves env-based price IDs
function getServerPlans(): Plan[] {
  return PLANS.map((plan) => {
    if (plan.id === 'creator') {
      return {
        ...plan,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_CREATOR || '',
        stripePriceIdYearly: process.env.STRIPE_PRICE_ID_CREATOR_YEARLY || '',
      }
    }
    if (plan.id === 'pro') {
      return {
        ...plan,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_PRO || '',
        stripePriceIdYearly: process.env.STRIPE_PRICE_ID_PRO_YEARLY || '',
      }
    }
    if (plan.id === 'agency') {
      return {
        ...plan,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_AGENCY || '',
        stripePriceIdYearly: process.env.STRIPE_PRICE_ID_AGENCY_YEARLY || '',
      }
    }
    return plan
  })
}

export function getPlanByPriceId(priceId: string): Plan | undefined {
  const plans = getServerPlans()
  return plans.find(
    (p) => p.stripePriceIdMonthly === priceId || p.stripePriceIdYearly === priceId
  )
}

export function isValidPriceId(priceId: string): boolean {
  return !!getPlanByPriceId(priceId)
}

export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const supabase = createServiceClient()

  // Check if customer already exists
  const { data: existing } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  })

  // Store in database
  await supabase.from('stripe_customers').insert({
    user_id: userId,
    stripe_customer_id: customer.id,
  })

  return customer.id
}

export async function getSubscription(userId: string) {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data
}
