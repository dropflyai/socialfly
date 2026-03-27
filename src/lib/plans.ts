export interface Plan {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  stripePriceIdMonthly: string | null
  stripePriceIdYearly: string | null
  credits: number
  brands: number | 'unlimited'
  platforms: number
  scheduledPosts: number | 'unlimited'
  teamMembers: number
  features: string[]
  popular?: boolean
}

export const CREDIT_COSTS = {
  caption: 1,
  image_edit: 3,
  image_generate: 5,
  video_fast: 25,
  video_quality: 50,
  publish: 0,
} as const

export type CreditAction = keyof typeof CREDIT_COSTS

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with AI-powered content',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    credits: 50,
    brands: 1,
    platforms: 2,
    scheduledPosts: 5,
    teamMembers: 1,
    features: [
      '50 credits/month',
      '1 brand profile',
      '2 social platforms',
      'AI content generation',
      'Manual posting',
      'Basic analytics',
    ],
  },
  {
    id: 'creator',
    name: 'Creator',
    description: 'For creators who mean business',
    priceMonthly: 19,
    priceYearly: 182,
    stripePriceIdMonthly: null, // Resolved from env at runtime
    stripePriceIdYearly: null,
    credits: 500,
    brands: 2,
    platforms: 5,
    scheduledPosts: 30,
    teamMembers: 1,
    features: [
      '500 credits/month',
      '2 brand profiles',
      '5 social platforms',
      'AI content generation',
      'Content calendar',
      '30 scheduled posts',
      'Basic analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For businesses ready to scale',
    priceMonthly: 49,
    priceYearly: 470,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    credits: 2000,
    brands: 5,
    platforms: 5,
    scheduledPosts: 'unlimited',
    teamMembers: 3,
    popular: true,
    features: [
      '2,000 credits/month',
      '5 brand profiles',
      '5 social platforms',
      'Unlimited scheduled posts',
      'Autopilot scheduling',
      'Advanced analytics',
      'Content calendar',
      'Video generation',
      '3 team members',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'For teams managing multiple brands',
    priceMonthly: 99,
    priceYearly: 950,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    credits: 5000,
    brands: 'unlimited',
    platforms: 5,
    scheduledPosts: 'unlimited',
    teamMembers: 10,
    features: [
      '5,000 credits/month',
      'Unlimited brand profiles',
      '5 social platforms',
      'Everything in Pro',
      'Priority support',
      '10 team members',
    ],
  },
]

export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId)
}

export function getCreditsForTier(tier: string): number {
  const plan = getPlanById(tier)
  return plan?.credits ?? 50
}

/** @deprecated Use getCreditsForTier instead */
export function getTokenLimitForTier(tier: string): number {
  return getCreditsForTier(tier)
}
