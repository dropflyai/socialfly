'use client'

/*
 * DASHBOARD - Design Intent Declaration
 *
 * User type: Social media manager, content creator, brand owner
 * Primary decision: What should I do next?
 * Excluded on purpose: Settings, billing, team management, analytics deep-dive
 * Failure definition: User doesn't know what to do or feels overwhelmed
 * UI Mode: MODE_SAAS
 *
 * Design principles applied:
 * - ONE primary action (set up brand OR create content)
 * - Asymmetrical layout (not grid of equal cards)
 * - Clear hierarchy (position > size > spacing > weight > color)
 * - Empty states that guide action
 * - Copy is direct, not marketing-speak
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase-client'
import { OnboardingChecklist } from '@/components/OnboardingChecklist'
import {
  ArrowRight,
  Sparkles,
  Calendar,
  Zap,
  Globe,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardData {
  user: { name?: string; email?: string } | null
  hasBrand: boolean
  brandName?: string
  platformsConnected: number
  postsScheduled: number
  automationsActive: number
  upcomingPosts: Array<{
    id: string
    title: string
    scheduledFor: string
    platforms: string[]
  }>
}

export default function DashboardPage() {
  const supabase = createBrowserClient()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check for brand profile
        const { data: brands } = await supabase
          .from('brand_profiles')
          .select('name')
          .eq('user_id', user.id)
          .limit(1)

        // Get counts
        const { count: platformCount } = await supabase
          .from('platform_connections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'active')

        const { count: postCount } = await supabase
          .from('scheduled_posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'scheduled')

        const { count: automationCount } = await supabase
          .from('automation_rules')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true)

        // Get upcoming posts
        const { data: posts } = await supabase
          .from('scheduled_posts')
          .select('id, scheduled_for, platforms')
          .eq('user_id', user.id)
          .eq('status', 'scheduled')
          .order('scheduled_for', { ascending: true })
          .limit(3)

        setData({
          user: {
            name: user.user_metadata?.full_name || user.email?.split('@')[0],
            email: user.email,
          },
          hasBrand: (brands?.length || 0) > 0,
          brandName: brands?.[0]?.name,
          platformsConnected: platformCount || 0,
          postsScheduled: postCount || 0,
          automationsActive: automationCount || 0,
          upcomingPosts: (posts || []).map(p => ({
            id: p.id,
            title: `Post to ${(p.platforms as string[]).join(', ')}`,
            scheduledFor: p.scheduled_for,
            platforms: p.platforms as string[],
          })),
        })
      }

      setLoading(false)
    }

    loadDashboard()
  }, [supabase])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!data) return null

  // Determine primary action based on state
  const needsBrandSetup = !data.hasBrand
  const needsPlatforms = data.platformsConnected === 0

  return (
    <div className="animate-fade-in">
      {/* Greeting - Simple, not excessive */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting()}, {data.user?.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          {needsBrandSetup
            ? 'Start by setting up your brand profile.'
            : needsPlatforms
            ? 'Connect your social accounts to start posting.'
            : "Here's your content status."}
        </p>
      </div>

      {/* Onboarding Checklist */}
      <div className="mb-6">
        <OnboardingChecklist />
      </div>

      {/* PRIMARY ACTION AREA - Dominant, not equal to other elements */}
      {needsBrandSetup ? (
        <PrimaryActionCard
          title="Set up your brand"
          description="We'll scan your website to understand your voice, audience, and visual style. This takes about 30 seconds."
          action="Enter your website URL"
          href="/brand/setup"
          icon={<Globe className="h-6 w-6" />}
        />
      ) : needsPlatforms ? (
        <PrimaryActionCard
          title="Connect your first platform"
          description="Link your social media accounts to start scheduling and posting content."
          action="Connect a platform"
          href="/platforms"
          icon={<Zap className="h-6 w-6" />}
        />
      ) : (
        <PrimaryActionCard
          title="Create content"
          description={`Generate posts that match ${data.brandName}'s voice using AI.`}
          action="Start creating"
          href="/content/create"
          icon={<Sparkles className="h-6 w-6" />}
        />
      )}

      {/* SECONDARY CONTENT - Smaller, supporting information */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr,320px]">
        {/* Left: Status overview */}
        <div className="space-y-8">
          {/* Quick Stats - Horizontal, not cards */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Status
            </h2>
            <div className="flex flex-wrap gap-8">
              <Stat
                label="Platforms"
                value={data.platformsConnected}
                href="/platforms"
              />
              <Stat
                label="Scheduled"
                value={data.postsScheduled}
                href="/schedule"
              />
              <Stat
                label="Automations"
                value={data.automationsActive}
                href="/automations"
              />
            </div>
          </div>

          {/* Secondary Actions - Not equal, not cards */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Quick actions
            </h2>
            <div className="space-y-2">
              <SecondaryAction
                title="Schedule a post"
                description="Add content to your calendar"
                href="/schedule"
                icon={Calendar}
              />
              <SecondaryAction
                title="Create an automation"
                description="Set up rules to run on autopilot"
                href="/automations/create"
                icon={Zap}
              />
              {data.hasBrand && (
                <SecondaryAction
                  title="View brand profile"
                  description="Review your voice and content settings"
                  href="/brand"
                  icon={TrendingUp}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: Upcoming posts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Upcoming
            </h2>
            {data.upcomingPosts.length > 0 && (
              <Link
                href="/schedule"
                className="text-sm text-primary hover:underline"
              >
                View all
              </Link>
            )}
          </div>

          {data.upcomingPosts.length === 0 ? (
            <EmptyUpcoming />
          ) : (
            <div className="space-y-3">
              {data.upcomingPosts.map((post) => (
                <UpcomingPost key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// COMPONENTS - Following design system

function PrimaryActionCard({
  title,
  description,
  action,
  href,
  icon,
}: {
  title: string
  description: string
  action: string
  href: string
  icon: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-8">
      {/* Subtle glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-6">
          {icon}
        </div>

        <h2 className="text-2xl font-semibold tracking-tight mb-2">{title}</h2>
        <p className="text-muted-foreground max-w-lg mb-6">{description}</p>

        <Button asChild size="lg" className="shadow-glow">
          <Link href={href}>
            {action}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  href,
}: {
  label: string
  value: number
  href: string
}) {
  return (
    <Link href={href} className="group">
      <div className="text-3xl font-semibold tracking-tight group-hover:text-primary transition-colors">
        {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Link>
  )
}

function SecondaryAction({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 -mx-4 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium group-hover:text-primary transition-colors">
          {title}
        </div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </Link>
  )
}

function EmptyUpcoming() {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground mb-3">
        No posts scheduled yet.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/schedule">Schedule a post</Link>
      </Button>
    </div>
  )
}

function UpcomingPost({
  post,
}: {
  post: { id: string; title: string; scheduledFor: string; platforms: string[] }
}) {
  const timeUntil = getTimeUntil(post.scheduledFor)

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Clock className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{post.title}</div>
        <div className="text-xs text-muted-foreground">{timeUntil}</div>
      </div>
      <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded mt-2" />
      </div>
      <div className="h-48 bg-muted rounded-2xl" />
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr,320px]">
        <div className="space-y-8">
          <div className="h-24 bg-muted rounded" />
          <div className="h-48 bg-muted rounded" />
        </div>
        <div className="h-64 bg-muted rounded" />
      </div>
    </div>
  )
}

// UTILITIES

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getTimeUntil(isoString: string) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `in ${diffMins} minutes`
  if (diffHours < 24) return `in ${diffHours} hours`
  if (diffDays === 1) return 'tomorrow'
  return `in ${diffDays} days`
}
