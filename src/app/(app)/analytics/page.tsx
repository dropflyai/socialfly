'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3, TrendingUp, Users, Eye, Heart, MessageCircle,
  RefreshCw, Calendar, ArrowUp, ArrowDown, Minus,
  Instagram, Facebook, Twitter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AnalyticsData {
  period: { days: number; since: string }
  overview: {
    totalPosts: number
    totalLikes: number
    totalComments: number
    totalImpressions: number
    totalReach: number
    engagementRate: number
  }
  platformBreakdown: Record<string, { posts: number; likes: number; comments: number }>
  postsByDay: Record<string, number>
  statusCounts: Record<string, number>
  topPosts: {
    id: string
    text: string
    platforms: string[]
    postedAt: string
    engagement: number
    metrics: Record<string, { likes?: number; comments?: number }> | null
  }[]
}

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
}

const platformColors: Record<string, string> = {
  instagram: 'text-pink-500',
  facebook: 'text-blue-600',
  twitter: 'text-sky-500',
  tiktok: 'text-neutral-800',
  linkedin: 'text-blue-700',
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  async function fetchAnalytics() {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?days=${days}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error('Analytics fetch error:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAnalytics()
  }, [days])

  const hasData = data && data.overview.totalPosts > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Track your social media performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">7d</TabsTrigger>
              <TabsTrigger value="30">30d</TabsTrigger>
              <TabsTrigger value="90">90d</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Posts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : data?.overview.totalPosts || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last {days} days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : (data?.overview.totalImpressions || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total views</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Likes</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {loading ? '...' : (data?.overview.totalLikes || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total likes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comments</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {loading ? '...' : (data?.overview.totalComments || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total comments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {loading ? '...' : `${data?.overview.engagementRate || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Engagement rate</p>
          </CardContent>
        </Card>
      </div>

      {!hasData && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl mb-2">No analytics data yet</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">
              Start publishing posts to see engagement metrics, reach, and growth data here.
            </CardDescription>
            <Button asChild className="gap-2">
              <Link href="/content/create">Create & Publish Content</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Platform Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Breakdown</CardTitle>
              <CardDescription>Performance by platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(data!.platformBreakdown).map(([platform, stats]) => {
                  const Icon = platformIcons[platform] || BarChart3
                  const color = platformColors[platform] || 'text-gray-500'
                  return (
                    <div key={platform} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${color}`} />
                        <div>
                          <p className="font-medium capitalize">{platform}</p>
                          <p className="text-xs text-muted-foreground">{stats.posts} posts</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3 text-rose-400" />
                          {stats.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3 text-blue-400" />
                          {stats.comments}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {Object.keys(data!.platformBreakdown).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No platform data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Post Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post Status</CardTitle>
              <CardDescription>Overview of all posts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(data!.statusCounts).map(([status, count]) => {
                  const colors: Record<string, string> = {
                    posted: 'bg-green-100 text-green-800',
                    scheduled: 'bg-blue-100 text-blue-800',
                    failed: 'bg-red-100 text-red-800',
                    partial: 'bg-yellow-100 text-yellow-800',
                    cancelled: 'bg-gray-100 text-gray-800',
                    draft: 'bg-gray-100 text-gray-600',
                  }
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant="outline" className={colors[status] || 'bg-gray-100'}>
                        {status}
                      </Badge>
                      <span className="font-semibold">{count}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Posting Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Posting Activity</CardTitle>
              <CardDescription>Posts per day over the last {days} days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {(() => {
                  const dayEntries = Object.entries(data!.postsByDay).sort(([a], [b]) => a.localeCompare(b))
                  const maxPosts = Math.max(...dayEntries.map(([, c]) => c), 1)

                  if (dayEntries.length === 0) {
                    return <p className="text-sm text-muted-foreground w-full text-center">No posting activity yet</p>
                  }

                  return dayEntries.map(([day, count]) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1" title={`${day}: ${count} posts`}>
                      <div
                        className="w-full bg-primary/80 rounded-t min-h-[4px] transition-all hover:bg-primary"
                        style={{ height: `${(count / maxPosts) * 100}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground rotate-45 origin-left">
                        {day.slice(5)}
                      </span>
                    </div>
                  ))
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Top Performing Posts */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Top Performing Posts</CardTitle>
              <CardDescription>Sorted by engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data!.topPosts.slice(0, 5).map((post, i) => (
                  <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{post.text || 'No caption'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {post.platforms.map(p => {
                          const Icon = platformIcons[p] || BarChart3
                          return <Icon key={p} className={`h-3 w-3 ${platformColors[p] || ''}`} />
                        })}
                        <span className="text-xs text-muted-foreground">
                          {post.postedAt ? new Date(post.postedAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-sm">{post.engagement}</span>
                      <p className="text-xs text-muted-foreground">engagements</p>
                    </div>
                  </div>
                ))}
                {data!.topPosts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No post performance data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
