/*
 * LANDING PAGE - Design Intent Declaration
 *
 * User type: Potential customer, social media manager, creator
 * Primary decision: Should I sign up?
 * Excluded on purpose: Feature comparison, pricing details, testimonials (keep simple)
 * Failure definition: User doesn't understand the value or how to start
 * UI Mode: MODE_SAAS
 *
 * Design principles:
 * - ONE primary CTA (sign up)
 * - Clear value prop above the fold
 * - Unique visual identity (not generic SaaS template)
 * - Direct copy, not marketing fluff
 */

import Link from 'next/link'
import { ArrowRight, Sparkles, Zap, Globe } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-glow"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6 py-24 md:py-32">
          <div className="text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-powered content automation
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6">
              Your brand's content.
              <br />
              <span className="text-primary">On autopilot.</span>
            </h1>

            {/* Subhead - direct, not fluffy */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Enter your website. We analyze your voice. Generate content that sounds like you.
              Schedule it everywhere. Done.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-8 py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-glow text-lg"
              >
                Start free
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 bg-muted text-foreground font-medium px-8 py-4 rounded-xl hover:bg-muted/80 transition-colors text-lg"
              >
                Sign in
              </Link>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* How it works - simple, not feature cards */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-center mb-12">
            How it works
          </h2>

          <div className="grid md:grid-cols-3 gap-12">
            <Step
              number="1"
              icon={Globe}
              title="Enter your URL"
              description="We scan your website to learn your voice, colors, and audience."
            />
            <Step
              number="2"
              icon={Sparkles}
              title="Generate content"
              description="AI creates posts, videos, and captions that match your brand."
            />
            <Step
              number="3"
              icon={Zap}
              title="Automate posting"
              description="Schedule across Instagram, TikTok, LinkedIn, and more."
            />
          </div>
        </div>
      </section>

      {/* Footer - minimal */}
      <footer className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
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

function Step({
  number,
  icon: Icon,
  title,
  description,
}: {
  number: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Step {number}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )
}
