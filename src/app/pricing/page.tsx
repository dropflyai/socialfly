'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  Sparkles,
  ArrowRight,
  Zap,
  Palette,
  Crown,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLANS, type Plan } from '@/lib/plans'

export default function PricingPage() {
  const router = useRouter()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const planIcons: Record<string, typeof Sparkles> = {
    free: Zap,
    creator: Palette,
    pro: Crown,
    agency: Building2,
  }

  async function handleSelectPlan(plan: Plan) {
    if (plan.id === 'free') {
      router.push('/auth/signup')
      return
    }

    setLoadingPlan(plan.id)

    const priceId = billing === 'yearly' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })

      if (res.status === 401) {
        router.push('/auth/signup')
        return
      }

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoadingPlan(null)
    }
  }

  function getPrice(plan: Plan) {
    if (plan.priceMonthly === 0) return 0
    if (billing === 'yearly') {
      return Math.round(plan.priceYearly / 12)
    }
    return plan.priceMonthly
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              S
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">
              SocialFly
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Simple, transparent pricing
          </div>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4">
            Pick the plan that fits
            <br />
            <span className="text-primary">your ambition</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Start free. Upgrade when you&apos;re ready. All paid plans include a 14-day free trial.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 p-1 rounded-xl bg-muted">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billing === 'yearly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Save 20%
              </Badge>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const Icon = planIcons[plan.id] || Zap
            const price = getPrice(plan)
            const isPopular = plan.popular

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isPopular
                    ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                    : 'border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${
                      isPopular ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Icon className={`h-5 w-5 ${isPopular ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${price}
                      </span>
                      {plan.priceMonthly > 0 && (
                        <span className="text-muted-foreground text-sm">/month</span>
                      )}
                    </div>
                    {billing === 'yearly' && plan.priceMonthly > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        ${plan.priceYearly}/year (billed annually)
                      </p>
                    )}
                    {plan.priceMonthly === 0 && (
                      <p className="text-sm text-muted-foreground mt-1">Free forever</p>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loadingPlan === plan.id}
                    className={`w-full mb-6 gap-2 ${
                      isPopular
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : ''
                    }`}
                    variant={isPopular ? 'default' : 'outline'}
                    size="lg"
                  >
                    {loadingPlan === plan.id ? (
                      'Loading...'
                    ) : plan.id === 'free' ? (
                      <>
                        Get Started
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Start 14-Day Trial
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {/* Features */}
                  <div className="space-y-3 flex-1">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Credit Costs Explainer */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-center mb-2">How credits work</h2>
        <p className="text-muted-foreground text-center mb-8">
          Different actions use different amounts of credits. Publishing to platforms is always free.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
            <span className="text-sm font-medium">AI Caption / Text</span>
            <Badge variant="secondary">1 credit</Badge>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
            <span className="text-sm font-medium">AI Image Edit</span>
            <Badge variant="secondary">3 credits</Badge>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
            <span className="text-sm font-medium">AI Image Generation</span>
            <Badge variant="secondary">5 credits</Badge>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
            <span className="text-sm font-medium">AI Video Generation</span>
            <Badge variant="secondary">15 credits</Badge>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-center mb-8">Compare plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
                <th className="text-center py-3 px-4 font-medium">Free</th>
                <th className="text-center py-3 px-4 font-medium">Creator</th>
                <th className="text-center py-3 px-4 font-medium text-primary">Pro</th>
                <th className="text-center py-3 px-4 font-medium">Agency</th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow feature="Monthly credits" free="50" creator="500" pro="2,000" agency="5,000" />
              <ComparisonRow feature="Brand profiles" free="1" creator="2" pro="5" agency="Unlimited" />
              <ComparisonRow feature="Social platforms" free="2" creator="5" pro="5" agency="5" />
              <ComparisonRow feature="Scheduled posts" free="5" creator="30" pro="Unlimited" agency="Unlimited" />
              <ComparisonRow feature="Team members" free="1" creator="1" pro="3" agency="10" />
              <ComparisonRow feature="AI content generation" free={true} creator={true} pro={true} agency={true} />
              <ComparisonRow feature="Content calendar" free={false} creator={true} pro={true} agency={true} />
              <ComparisonRow feature="Autopilot scheduling" free={false} creator={false} pro={true} agency={true} />
              <ComparisonRow feature="Advanced analytics" free={false} creator={false} pro={true} agency={true} />
              <ComparisonRow feature="Video generation" free={false} creator={false} pro={true} agency={true} />
              <ComparisonRow feature="Priority support" free={false} creator={false} pro={false} agency={true} />
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ-style bottom CTA */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold mb-4">Still have questions?</h2>
          <p className="text-muted-foreground mb-6">
            Start with the free plan and upgrade anytime. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/auth/signup">
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="mailto:support@socialfly.io">Contact sales</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs font-bold">S</span>
            </div>
            SocialFly
          </div>
          <p className="text-sm text-muted-foreground">
            Built for creators who value their time.
          </p>
        </div>
      </footer>
    </div>
  )
}

function ComparisonRow({
  feature,
  free,
  creator,
  pro,
  agency,
}: {
  feature: string
  free: string | boolean
  creator: string | boolean
  pro: string | boolean
  agency: string | boolean
}) {
  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-4 w-4 text-primary mx-auto" />
      ) : (
        <span className="text-muted-foreground/40">-</span>
      )
    }
    return <span className="text-foreground">{value}</span>
  }

  return (
    <tr className="border-b border-border/50">
      <td className="py-3 px-4 text-muted-foreground">{feature}</td>
      <td className="py-3 px-4 text-center">{renderValue(free)}</td>
      <td className="py-3 px-4 text-center">{renderValue(creator)}</td>
      <td className="py-3 px-4 text-center bg-primary/[0.02]">{renderValue(pro)}</td>
      <td className="py-3 px-4 text-center">{renderValue(agency)}</td>
    </tr>
  )
}
