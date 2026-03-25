import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, getPlanByPriceId, getTokenLimitForTier } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase-server'

// Helper to extract subscription ID from invoice parent
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  if (
    invoice.parent &&
    invoice.parent.type === 'subscription_details' &&
    invoice.parent.subscription_details?.subscription
  ) {
    const sub = invoice.parent.subscription_details.subscription
    return typeof sub === 'string' ? sub : sub.id
  }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = getSubscriptionIdFromInvoice(invoice)
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await handleSubscriptionChange(supabase, subscription)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = getSubscriptionIdFromInvoice(invoice)
        if (subscriptionId) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId)
        }
        break
      }

      default:
        // Unhandled event type
        break
    }
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function getUserIdFromCustomer(
  supabase: ReturnType<typeof createServiceClient>,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  return data?.user_id ?? null
}

async function handleSubscriptionChange(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string
  const userId = await getUserIdFromCustomer(supabase, customerId)

  if (!userId) {
    console.error('No user found for Stripe customer:', customerId)
    return
  }

  const firstItem = subscription.items.data[0]
  const priceId = firstItem?.price?.id
  const plan = getPlanByPriceId(priceId || '')
  const tier = plan?.id || 'free'

  // Get period dates from the first subscription item
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null

  // Upsert subscription record
  const subscriptionData = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (existing) {
    await supabase
      .from('subscriptions')
      .update(subscriptionData)
      .eq('stripe_subscription_id', subscription.id)
  } else {
    await supabase.from('subscriptions').insert(subscriptionData)
  }

  // Update profile tier
  await supabase
    .from('profiles')
    .update({ subscription_tier: tier })
    .eq('id', userId)

  // Update token daily limit based on tier
  const dailyLimit = getTokenLimitForTier(tier)
  await supabase
    .from('token_balances')
    .update({ daily_limit: dailyLimit })
    .eq('user_id', userId)
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string
  const userId = await getUserIdFromCustomer(supabase, customerId)

  if (!userId) {
    console.error('No user found for Stripe customer:', customerId)
    return
  }

  // Mark subscription as canceled
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  // Downgrade to free tier
  await supabase
    .from('profiles')
    .update({ subscription_tier: 'free' })
    .eq('id', userId)

  // Reset token limit to free tier
  await supabase
    .from('token_balances')
    .update({ daily_limit: 50 })
    .eq('user_id', userId)
}
