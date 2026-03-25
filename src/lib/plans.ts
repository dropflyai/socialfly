export interface Plan {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  stripePriceIdMonthly: string | null
  stripePriceIdYearly: string | null
  tokens: number
  brands: number | 'unlimited'
  platforms: number
  features: string[]
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with AI-powered content',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    tokens: 50,
    brands: 1,
    platforms: 2,
    features: [
      '50 tokens per day',
      '1 brand profile',
      '2 social platforms',
      'AI content generation',
      'Manual posting',
      'Basic analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For creators who mean business',
    priceMonthly: 29,
    priceYearly: 278,
    stripePriceIdMonthly: null, // Set at runtime from env
    stripePriceIdYearly: null,
    tokens: 500,
    brands: 3,
    platforms: 5,
    popular: true,
    features: [
      '500 tokens per day',
      '3 brand profiles',
      '5 social platforms',
      'AI content generation',
      'Autopilot scheduling',
      'Advanced analytics',
      'Content calendar',
      'Video generation',
      'Priority generation queue',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'For teams managing multiple brands',
    priceMonthly: 99,
    priceYearly: 950,
    stripePriceIdMonthly: null, // Set at runtime from env
    stripePriceIdYearly: null,
    tokens: 2000,
    brands: 'unlimited',
    platforms: 5,
    features: [
      '2,000 tokens per day',
      'Unlimited brand profiles',
      '5 social platforms',
      'Everything in Pro',
      'White-label reports',
      'Priority support',
      'API access',
      'Custom AI training',
      'Team collaboration',
    ],
  },
]

export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId)
}

export function getTokenLimitForTier(tier: string): number {
  const plan = getPlanById(tier)
  return plan?.tokens ?? 50
}
