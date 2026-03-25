'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-client'
import {
  User, CreditCard, Bell, Save, ExternalLink, ArrowUpRight,
  Coins, Calendar, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <SettingsPageContent />
    </Suspense>
  )
}

interface SubscriptionData {
  subscription: {
    id: string
    status: string
    priceId: string
    currentPeriodEnd: string
    currentPeriodStart: string
    cancelAtPeriodEnd: boolean
  } | null
  plan: {
    id: string
    name: string
    tokens: number
  }
  tokens: {
    balance: number
    dailySpent: number
    dailyLimit: number
  }
  tier: string
}

function SettingsPageContent() {
  const supabase = createBrowserClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'profile'
  const checkoutStatus = searchParams.get('checkout')

  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [billingData, setBillingData] = useState<SubscriptionData | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser({
          email: user.email,
          name: user.user_metadata?.full_name,
        })
      }
      setLoading(false)
    }
    getUser()
  }, [supabase])

  const fetchBilling = useCallback(async () => {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/billing/subscription')
      if (res.ok) {
        const data = await res.json()
        setBillingData(data)
      }
    } catch (e) {
      console.error('Failed to fetch billing:', e)
    }
    setBillingLoading(false)
  }, [])

  useEffect(() => {
    if (defaultTab === 'billing') {
      fetchBilling()
    }
  }, [defaultTab, fetchBilling])

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (e) {
      console.error('Portal error:', e)
    }
    setPortalLoading(false)
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      trialing: { label: 'Trial', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
      past_due: { label: 'Past Due', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
      canceled: { label: 'Canceled', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
      inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
    }
    const v = variants[status] || variants.inactive
    return <Badge variant="outline" className={v.className}>{v.label}</Badge>
  }

  const tokenUsagePercent = billingData
    ? Math.min(100, Math.round((billingData.tokens.dailySpent / billingData.tokens.dailyLimit) * 100))
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6" onValueChange={(v) => {
        if (v === 'billing' && !billingData) fetchBilling()
      }}>
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue={user?.name || ''} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email || ''} disabled />
                </div>
              </div>
              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>Irreversible account actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                <div>
                  <h4 className="font-medium">Delete Account</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          {/* Checkout success banner */}
          {checkoutStatus === 'success' && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">Subscription activated!</p>
                <p className="text-sm text-green-700 dark:text-green-400">
                  Your plan has been upgraded. It may take a moment for changes to appear.
                </p>
              </div>
            </div>
          )}

          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Manage your subscription and billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-lg">
                            {billingData?.plan.name || 'Free'} Plan
                          </h4>
                          {billingData?.subscription
                            ? getStatusBadge(billingData.subscription.status)
                            : getStatusBadge('inactive')}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {billingData?.plan.tokens || 50} tokens per day
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {billingData?.subscription && (
                        <Button
                          variant="outline"
                          onClick={handleManageSubscription}
                          disabled={portalLoading}
                          className="gap-2"
                        >
                          {portalLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                          Manage Subscription
                        </Button>
                      )}
                      {(!billingData?.subscription || billingData.tier === 'free') && (
                        <Button onClick={() => router.push('/pricing')} className="gap-2">
                          <ArrowUpRight className="h-4 w-4" />
                          Upgrade
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Renewal info */}
                  {billingData?.subscription && billingData.subscription.currentPeriodEnd && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {billingData.subscription.cancelAtPeriodEnd ? (
                        <span>
                          Your plan will be canceled on{' '}
                          {new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span>
                          Next billing date:{' '}
                          {new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  )}

                  {billingData?.subscription?.status === 'past_due' && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        Your payment is past due. Please update your payment method to avoid service interruption.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Token Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Token Usage
              </CardTitle>
              <CardDescription>
                Tokens are used for AI content generation and video creation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Daily usage</p>
                      <p className="text-2xl font-bold">
                        {billingData?.tokens.dailySpent ?? 0}
                        <span className="text-base font-normal text-muted-foreground">
                          {' '}/ {billingData?.tokens.dailyLimit ?? 50}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Available balance</p>
                      <p className="text-2xl font-bold text-primary">
                        {billingData?.tokens.balance ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          tokenUsagePercent > 90
                            ? 'bg-red-500'
                            : tokenUsagePercent > 70
                              ? 'bg-yellow-500'
                              : 'bg-primary'
                        }`}
                        style={{ width: `${tokenUsagePercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {tokenUsagePercent}% of daily limit used
                    </p>
                  </div>

                  {tokenUsagePercent > 90 && billingData?.tier === 'free' && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <AlertCircle className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm">
                          Running low on tokens? Upgrade to Pro for 500 tokens/day.
                        </p>
                      </div>
                      <Button size="sm" onClick={() => router.push('/pricing')}>
                        Upgrade
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Email Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about your posts and automations
                  </p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Push Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified in your browser
                  </p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
