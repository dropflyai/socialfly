'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Users, RefreshCw, Hash,
  Instagram, Facebook, Twitter, Loader2, Sparkles, Recycle,
  ArrowUp, ArrowDown, Clock, Target, Zap, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Types matching the API response
interface GrowthMetric {
  platform: string
  currentFollowers: number
  previousFollowers: number
  growthAbsolute: number
  growthPercent: number
  avgDailyGrowth: number
  projectedMonthly: number
  trend: 'up' | 'down' | 'flat'
}

interface ContentScore {
  postId: string
  text: string
  platforms: string[]
  postedAt: string
  score: number
  metrics: {
    likes: number
    comments: number
    shares: number
    impressions: number
    reach: number
    saves: number
  }
  hashtags: string[]
  recycleWorthy: boolean
  reason: string
}

interface GrowthRecommendation {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  impact: string
}

interface HashtagSuggestion {
  hashtag: string
  category: 'niche' | 'trending' | 'brand' | 'community'
  estimatedReach: string
  competitionLevel: 'low' | 'medium' | 'high'
  recommended: boolean
}

interface GrowthData {
  period: { days: number }
  metrics?: GrowthMetric[]
  scores?: {
    total: number
    recycleWorthy: number
    topPosts: ContentScore[]
    recycleReady: ContentScore[]
  }
  bestTimes?: Record<string, { hour: number; day: string; avgEngagement: number }[]>
  recommendations?: {
    summary: string
    recommendations: GrowthRecommendation[]
    nextActions: string[]
  }
}

interface HashtagData {
  total: number
  recommended: number
  suggestions: HashtagSuggestion[]
  recommendedSet: string
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
  tiktok: 'text-neutral-800 dark:text-neutral-200',
  linkedin: 'text-blue-700',
}

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

const trendColors = {
  up: 'text-green-500',
  down: 'text-red-500',
  flat: 'text-yellow-500',
}

const priorityColors = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

export default function GrowthPage() {
  const [data, setData] = useState<GrowthData | null>(null)
  const [hashtags, setHashtags] = useState<HashtagData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hashtagLoading, setHashtagLoading] = useState(false)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchGrowth = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/growth?days=${days}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch (e) {
      console.error('Growth fetch error:', e)
    }
    setLoading(false)
  }, [days])

  const fetchHashtags = async () => {
    setHashtagLoading(true)
    try {
      const res = await fetch('/api/growth/hashtags')
      if (res.ok) {
        setHashtags(await res.json())
      }
    } catch (e) {
      console.error('Hashtag fetch error:', e)
    }
    setHashtagLoading(false)
  }

  useEffect(() => {
    fetchGrowth()
  }, [fetchGrowth])

  const totalFollowers = data?.metrics?.reduce((sum, m) => sum + m.currentFollowers, 0) || 0
  const totalGrowth = data?.metrics?.reduce((sum, m) => sum + m.growthAbsolute, 0) || 0
  const avgDailyGrowth = data?.metrics?.reduce((sum, m) => sum + m.avgDailyGrowth, 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-500" />
            Growth Engine
          </h1>
          <p className="text-muted-foreground">Track followers, optimize content, and grow your audience</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">7d</TabsTrigger>
              <TabsTrigger value="30">30d</TabsTrigger>
              <TabsTrigger value="90">90d</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" onClick={fetchGrowth} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Followers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : totalFollowers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all platforms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Growth ({days}d)</CardTitle>
            {totalGrowth >= 0 ? <ArrowUp className="h-4 w-4 text-green-500" /> : <ArrowDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {loading ? '...' : `${totalGrowth >= 0 ? '+' : ''}${totalGrowth}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Net new followers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Avg</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${avgDailyGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {loading ? '...' : `${avgDailyGrowth >= 0 ? '+' : ''}${avgDailyGrowth.toFixed(1)}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Followers/day</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recycle Ready</CardTitle>
            <Recycle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">
              {loading ? '...' : data?.scores?.recycleWorthy || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Posts worth reposting</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content Scores</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Per-Platform Growth */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Growth</CardTitle>
              <CardDescription>Follower changes over the last {days} days</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : data?.metrics?.length ? (
                <div className="space-y-4">
                  {data.metrics.map((m) => {
                    const Icon = platformIcons[m.platform] || Users
                    const TIcon = trendIcons[m.trend]
                    const color = platformColors[m.platform] || 'text-gray-500'
                    const tColor = trendColors[m.trend]
                    return (
                      <div key={m.platform} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${color}`} />
                          <div>
                            <p className="font-medium capitalize">{m.platform}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.currentFollowers.toLocaleString()} followers
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`font-semibold ${tColor}`}>
                              {m.growthAbsolute >= 0 ? '+' : ''}{m.growthAbsolute}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.growthPercent >= 0 ? '+' : ''}{m.growthPercent}%
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <TIcon className={`h-4 w-4 ${tColor}`} />
                            <span className="text-xs text-muted-foreground">
                              ~{m.avgDailyGrowth}/day
                            </span>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">30d projection</p>
                            <p className="text-sm font-medium">
                              {m.projectedMonthly >= 0 ? '+' : ''}{m.projectedMonthly}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No follower data yet. Growth snapshots run daily at 6 AM UTC.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check back tomorrow for your first growth data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Best Posting Times */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Best Posting Times
              </CardTitle>
              <CardDescription>Based on your actual engagement data</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.bestTimes ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {Object.entries(data.bestTimes).map(([platform, times]) => {
                    const Icon = platformIcons[platform] || Users
                    const color = platformColors[platform] || 'text-gray-500'
                    return (
                      <div key={platform} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <span className="font-medium capitalize text-sm">{platform}</span>
                        </div>
                        <div className="space-y-1">
                          {times.slice(0, 3).map((t, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span>{t.day} {t.hour > 12 ? `${t.hour - 12}PM` : t.hour === 0 ? '12AM' : `${t.hour}AM`}</span>
                              {t.avgEngagement > 0 && (
                                <Badge variant="outline" className="text-[10px]">
                                  {t.avgEngagement} avg eng
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Loading posting times...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTENT SCORES TAB */}
        <TabsContent value="content" className="space-y-6">
          {/* Top Performing Posts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Content Performance Scores
              </CardTitle>
              <CardDescription>Posts ranked by weighted engagement (comments 3x, shares 5x, saves 4x)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.scores?.topPosts?.map((post, i) => (
                  <div key={post.postId} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-muted-foreground">#{i + 1}</span>
                      <span className={`text-xs font-semibold ${post.score > 10 ? 'text-green-500' : post.score > 5 ? 'text-yellow-500' : 'text-gray-500'}`}>
                        {post.score}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{post.text || 'No caption'}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {post.platforms.map(p => {
                          const Icon = platformIcons[p] || Users
                          return <Icon key={p} className={`h-3 w-3 ${platformColors[p] || ''}`} />
                        })}
                        <span className="text-xs text-muted-foreground">
                          {post.postedAt ? new Date(post.postedAt).toLocaleDateString() : ''}
                        </span>
                        {post.recycleWorthy && (
                          <Badge variant="outline" className="text-[10px] text-purple-500 border-purple-500/30">
                            <Recycle className="h-2.5 w-2.5 mr-1" />
                            Recycle
                          </Badge>
                        )}
                      </div>
                      {post.reason && (
                        <p className="text-xs text-purple-500 mt-1">{post.reason}</p>
                      )}
                    </div>
                    <div className="text-right text-xs space-y-0.5">
                      <div className="flex items-center gap-1 justify-end">
                        <span>{post.metrics.likes}</span> likes
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <span>{post.metrics.comments}</span> comments
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <span>{post.metrics.shares}</span> shares
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground text-center py-8">No scored content yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recycle-Ready Posts */}
          {data?.scores?.recycleReady && data.scores.recycleReady.length > 0 && (
            <Card className="border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Recycle className="h-4 w-4 text-purple-500" />
                  Recycle-Ready Posts ({data.scores.recycleWorthy})
                </CardTitle>
                <CardDescription>
                  These high-performing posts are old enough to repost with a fresh angle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.scores.recycleReady.map((post) => (
                    <div key={post.postId} className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                      <p className="text-sm">{post.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          Score: {post.score} | {new Date(post.postedAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-purple-500">{post.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HASHTAGS TAB */}
        <TabsContent value="hashtags" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Smart Hashtag Research
                  </CardTitle>
                  <CardDescription>AI-powered hashtag suggestions based on your brand and performance</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={hashtagLoading}
                  onClick={fetchHashtags}
                >
                  {hashtagLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {hashtags ? 'Refresh' : 'Generate Suggestions'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {hashtagLoading ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Analyzing your niche and generating hashtags...</span>
                </div>
              ) : hashtags ? (
                <div className="space-y-6">
                  {/* Recommended Set (copy-paste ready) */}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-xs font-medium text-primary mb-2">Recommended Set (copy & paste)</p>
                    <p className="text-sm font-mono select-all cursor-pointer">{hashtags.recommendedSet}</p>
                  </div>

                  {/* All Suggestions */}
                  <div className="space-y-2">
                    {hashtags.suggestions.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{s.hashtag}</span>
                          {s.recommended && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                          <Badge variant="outline" className="text-[10px]">{s.estimatedReach}</Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              s.competitionLevel === 'low' ? 'text-green-500' :
                              s.competitionLevel === 'medium' ? 'text-yellow-500' : 'text-red-500'
                            }`}
                          >
                            {s.competitionLevel}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Hash className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Click &quot;Generate Suggestions&quot; to get AI-powered hashtag recommendations.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* STRATEGY TAB */}
        <TabsContent value="strategy" className="space-y-6">
          {data?.recommendations ? (
            <>
              {/* Summary */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Growth Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{data.recommendations.summary}</p>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <div className="space-y-3">
                {data.recommendations.recommendations.map((rec, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={priorityColors[rec.priority]}>
                              {rec.priority}
                            </Badge>
                            <h3 className="font-medium text-sm">{rec.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Expected Impact</p>
                          <p className="text-sm font-medium text-green-500">{rec.impact}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Next Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Next Actions
                  </CardTitle>
                  <CardDescription>Do these today to start seeing results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.recommendations.nextActions.map((action, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {loading ? 'Loading growth strategy...' : 'Strategy will appear once growth data is available.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
