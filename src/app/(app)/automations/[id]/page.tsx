'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Loader2, ImageIcon, Eye, Send, Trash2, Sparkles, Check, X,
  BarChart3, Clock, Calendar, Heart, MessageCircle, Zap, Play, Pause, Pencil, RefreshCw,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { RejectFeedbackDialog } from '@/components/RejectFeedbackDialog'

const toneOptions = [
  'Professional', 'Casual', 'Friendly', 'Witty', 'Inspirational', 'Educational', 'Bold', 'Conversational',
]

const platformOptions = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'tiktok', name: 'TikTok' },
]

const scheduleOptions = [
  { id: 'daily', name: 'Daily' },
  { id: 'weekdays', name: 'Weekdays' },
  { id: 'weekly', name: 'Weekly' },
  { id: 'biweekly', name: 'Bi-weekly' },
]

interface PostItem {
  id: string
  status: string
  platforms: string[]
  scheduledFor?: string
  postedAt?: string
  text: string
  mediaUrls: string[]
  variants?: Record<string, { text: string; hashtags?: string[] }> | null
  metrics?: Record<string, { likes?: number; comments?: number }>
  createdAt: string
}

interface AutomationStats {
  totalPosted: number
  totalLikes: number
  totalComments: number
  totalEngagement: number
  pendingCount: number
  scheduledCount: number
}

export default function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)

  // Preview
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<{
    text: string
    imagePrompt?: string
    variants?: Record<string, { text: string; hashtags?: string[] }>
    topic?: string
  } | null>(null)

  // Brands
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string>('')

  // Automation config
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [ruleStatus, setRuleStatus] = useState('active')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState('daily')
  const [topics, setTopics] = useState('')
  const [tone, setTone] = useState('Professional')
  const [includeImages, setIncludeImages] = useState(true)
  const [autoPublish, setAutoPublish] = useState(true)
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [painPoints, setPainPoints] = useState('')
  const [industry, setIndustry] = useState('')
  const [contentExamples, setContentExamples] = useState('')
  const [runCount, setRunCount] = useState(0)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [isCampaign, setIsCampaign] = useState(false)
  const [campaignStart, setCampaignStart] = useState<string | null>(null)
  const [campaignEnd, setCampaignEnd] = useState<string | null>(null)
  const [campaignGoal, setCampaignGoal] = useState<string | null>(null)
  const [campaignGoalTarget, setCampaignGoalTarget] = useState<number | null>(null)

  // Posts data
  const [upcoming, setUpcoming] = useState<PostItem[]>([])
  const [history, setHistory] = useState<PostItem[]>([])
  const [stats, setStats] = useState<AutomationStats>({ totalPosted: 0, totalLikes: 0, totalComments: 0, totalEngagement: 0, pendingCount: 0, scheduledCount: 0 })

  useEffect(() => {
    async function fetchData() {
      try {
        const [rulesRes, brandsRes, postsRes] = await Promise.all([
          fetch('/api/automations'),
          fetch('/api/brand/analyze'),
          fetch(`/api/automations/posts?ruleId=${id}`),
        ])

        if (brandsRes.ok) {
          const brandsData = await brandsRes.json()
          if (brandsData?.brandProfiles?.length) {
            setBrands(brandsData.brandProfiles.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })))
          }
        }

        if (postsRes.ok) {
          const postsData = await postsRes.json()
          setUpcoming(postsData.upcoming || [])
          setHistory(postsData.history || [])
          setStats(postsData.stats || stats)
        }

        if (!rulesRes.ok) throw new Error('Failed to fetch')
        const data = await rulesRes.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rule = (data.rules || []).find((r: any) => r.id === id)
        if (!rule) { router.push('/automations'); return }

        setName(rule.name)
        setType(rule.type)
        setRuleStatus(rule.status)
        setSelectedBrandId(rule.brand_id || '')
        setSelectedPlatforms(rule.platforms || [])
        setSelectedSchedule(rule.schedule || 'daily')
        setRunCount(rule.run_count || 0)
        setLastRun(rule.last_run)
        setIsCampaign(rule.is_campaign || false)
        setCampaignStart(rule.campaign_start || null)
        setCampaignEnd(rule.campaign_end || null)
        setCampaignGoal(rule.campaign_goal || null)
        setCampaignGoalTarget(rule.campaign_goal_target || null)

        const cfg = rule.config || {}
        setTopics(Array.isArray(cfg.topics) ? cfg.topics.join(', ') : '')
        setTone((cfg.tone as string) || 'Professional')
        setIncludeImages(cfg.includeImages !== false)
        setAutoPublish(cfg.autoPublish !== false)
        setProductName((cfg.product as string) || '')
        setProductDescription((cfg.productDescription as string) || '')
        setPainPoints(Array.isArray(cfg.painPoints) ? cfg.painPoints.join(', ') : '')
        setIndustry((cfg.industry as string) || '')
        setContentExamples((cfg.contentExamples as string) || '')
      } catch {
        setError('Failed to load automation')
      }
      setLoading(false)
    }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  function togglePlatform(pid: string) {
    setSelectedPlatforms(prev =>
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const config: Record<string, unknown> = {
      topics: topics.split(',').map(t => t.trim()).filter(Boolean),
      tone, includeImages, autoPublish,
      contentExamples: contentExamples || undefined,
      industry: industry || undefined,
    }
    if (type === 'product_ad') {
      config.product = productName
      config.productDescription = productDescription
      config.painPoints = painPoints.split(',').map(t => t.trim()).filter(Boolean)
    }
    try {
      const res = await fetch(`/api/automations?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config, platforms: selectedPlatforms, schedule: selectedSchedule, brandId: selectedBrandId || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
      }
    } catch { setError('Something went wrong') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this automation? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/automations?id=${id}`, { method: 'DELETE' })
    router.push('/automations')
  }

  async function handleToggle() {
    const newStatus = ruleStatus === 'active' ? 'paused' : 'active'
    await fetch(`/api/automations?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setRuleStatus(newStatus)
  }

  const [runResult, setRunResult] = useState<string | null>(null)
  const [runStep, setRunStep] = useState<string | null>(null)

  async function handleRunNow() {
    setTriggering(true)
    setRunResult(null)

    try {
      setRunStep('Preparing automation...')
      await fetch(`/api/automations?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runNow: true }),
      })

      setRunStep('Generating content with AI...')
      const res = await fetch('/api/cron/automations', {
        method: 'POST',
        headers: { Authorization: 'Bearer socialfly_cron_secret_2026' },
      })

      if (res.ok) {
        const data = await res.json()
        const result = data.results?.[0]

        if (result?.success) {
          setRunStep('Loading new post...')
          const postsRes = await fetch(`/api/automations/posts?ruleId=${id}`)
          if (postsRes.ok) {
            const postsData = await postsRes.json()
            setUpcoming(postsData.upcoming || [])
            setHistory(postsData.history || [])
            setStats(postsData.stats || stats)
          }
          setRunCount(prev => prev + 1)
          setLastRun(new Date().toISOString())
          setRunResult(autoPublish
            ? 'Post generated and scheduled! It will publish in ~5 minutes.'
            : 'Post generated! Review it below in Pending Review.')
        } else {
          setRunResult(`Failed: ${result?.error || 'Unknown error'}`)
        }
      } else {
        setRunResult('Failed to trigger automation')
      }
    } catch {
      setRunResult('Something went wrong')
    }
    setRunStep(null)
    setTriggering(false)
  }

  async function handlePreview() {
    setPreviewing(true)
    setPreview(null)
    try {
      const config: Record<string, unknown> = {
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        tone, contentExamples: contentExamples || undefined, industry: industry || undefined,
      }
      if (type === 'product_ad') {
        config.product = productName
        config.productDescription = productDescription
        config.painPoints = painPoints.split(',').map(t => t.trim()).filter(Boolean)
      }
      const res = await fetch('/api/automations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config, platforms: selectedPlatforms, brandId: selectedBrandId || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreview(data.preview)
      } else {
        const data = await res.json()
        setError(data.error || 'Preview failed')
      }
    } catch { setError('Preview failed') }
    setPreviewing(false)
  }

  async function handleApproveDraft(postId: string) {
    await fetch(`/api/posts/schedule?id=${postId}&action=approve`, { method: 'PATCH' })
    setUpcoming(prev => prev.map(p => p.id === postId ? { ...p, status: 'scheduled' } : p))
  }

  const [rejectingPost, setRejectingPost] = useState<PostItem | null>(null)

  async function handleRejectDraft(postId: string) {
    await fetch(`/api/posts/schedule?id=${postId}`, { method: 'DELETE' })
    setUpcoming(prev => prev.filter(p => p.id !== postId))
    setRejectingPost(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  const brandName = brands.find(b => b.id === selectedBrandId)?.name

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/automations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
              {isCampaign && <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">Campaign</Badge>}
              <Badge variant={ruleStatus === 'active' ? 'default' : 'secondary'}>
                {ruleStatus === 'active' ? 'Active' : 'Paused'}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {type?.replace(/_/g, ' ')} · {selectedSchedule} · {selectedPlatforms.join(', ')}
              {brandName && ` · ${brandName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToggle} className="gap-1">
            {ruleStatus === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {ruleStatus === 'active' ? 'Pause' : 'Activate'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRunNow} disabled={triggering} className="gap-1">
            {triggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Run Now
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Run progress / result */}
      {runStep && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium text-primary">{runStep}</p>
              <p className="text-xs text-muted-foreground mt-0.5">This may take 15-30 seconds</p>
            </div>
          </div>
        </div>
      )}

      {runResult && !runStep && (
        <div className={`p-3 rounded-lg text-sm flex items-center justify-between ${
          runResult.startsWith('Failed') || runResult.startsWith('Something')
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-green-500/10 border border-green-500/20 text-green-400'
        }`}>
          <div className="flex items-center gap-2">
            {runResult.startsWith('Failed') || runResult.startsWith('Something')
              ? <X className="h-4 w-4" />
              : <Check className="h-4 w-4" />
            }
            <span>{runResult}</span>
          </div>
          <button onClick={() => setRunResult(null)} className="text-muted-foreground hover:text-foreground ml-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Campaign progress */}
      {isCampaign && campaignStart && campaignEnd && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Campaign Progress</span>
              </div>
              {campaignGoal && (
                <Badge variant="outline" className="capitalize text-xs">{campaignGoal.replace(/_/g, ' ')}{campaignGoalTarget ? `: ${campaignGoalTarget}` : ''}</Badge>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(campaignStart).toLocaleDateString()}</span>
              <span>{new Date(campaignEnd).toLocaleDateString()}</span>
            </div>
            {(() => {
              const start = new Date(campaignStart).getTime()
              const end = new Date(campaignEnd).getTime()
              const now = Date.now()
              const progress = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
              const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
              return (
                <>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{progress}% complete</span>
                    <span className="text-muted-foreground">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
                  </div>
                </>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{stats.totalPosted + upcoming.length}</p>
          <p className="text-xs text-muted-foreground">Posts Created</p>
          <p className="text-[10px] text-muted-foreground">{stats.totalPosted} published · {upcoming.length} queued</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-pink-500">{stats.totalLikes}</p>
          <p className="text-xs text-muted-foreground">Total Likes</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-500">{stats.totalComments}</p>
          <p className="text-xs text-muted-foreground">Total Comments</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{stats.pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending Review</p>
        </CardContent></Card>
      </div>

      {lastRun && (
        <p className="text-xs text-muted-foreground">Last run: {new Date(lastRun).toLocaleString()}</p>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Sparkles className="h-4 w-4" />Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Pending Review */}
          {upcoming.filter(p => p.status === 'draft').length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" />Pending Review ({upcoming.filter(p => p.status === 'draft').length})</h3>
              {upcoming.filter(p => p.status === 'draft').map(post => (
                <DraftReviewCard key={post.id} post={post} onApprove={handleApproveDraft} onReject={(p) => setRejectingPost(p)} />
              ))}
            </div>
          )}

          {/* Upcoming Scheduled */}
          {upcoming.filter(p => p.status === 'scheduled').length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Upcoming</h3>
              {upcoming.filter(p => p.status === 'scheduled').map(post => (
                <Card key={post.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {post.mediaUrls.length > 0 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.mediaUrls[0]} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{post.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {post.platforms.map(p => <Badge key={p} variant="secondary" className="text-[10px] capitalize">{p}</Badge>)}
                        {post.scheduledFor && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(post.scheduledFor).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">Scheduled</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Post History */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" />Post History</h3>
            {history.length > 0 ? (
              history.map(post => (
                <Card key={post.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {post.mediaUrls.length > 0 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.mediaUrls[0]} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{post.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {post.platforms.map(p => <Badge key={p} variant="secondary" className="text-[10px] capitalize">{p}</Badge>)}
                        {post.postedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(post.postedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                      {post.metrics && (() => {
                        let likes = 0, comments = 0
                        for (const m of Object.values(post.metrics)) {
                          likes += m.likes || 0
                          comments += m.comments || 0
                        }
                        return (
                          <>
                            <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-pink-500" />{likes}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-blue-500" />{comments}</span>
                          </>
                        )
                      })()}
                      <Badge variant={post.status === 'posted' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {post.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No posts yet. Click &quot;Run Now&quot; to generate the first post.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-5">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          {brands.length > 0 && (
            <div className="space-y-2">
              <Label>Brand Profile</Label>
              <div className="grid gap-2">
                {brands.map(brand => (
                  <button key={brand.id} onClick={() => setSelectedBrandId(brand.id)}
                    className={`p-3 rounded-lg border text-sm font-medium text-left transition-all ${selectedBrandId === brand.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}>
                    {brand.name}
                    {selectedBrandId === brand.id && <Check className="h-4 w-4 text-primary inline ml-2" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(type === 'content_calendar' || type === 'ai_news') && (
            <div className="space-y-2">
              <Label>{type === 'ai_news' ? 'Industry / Topics' : 'Topics & Themes'}</Label>
              <Input placeholder="Separate with commas"
                value={type === 'ai_news' ? industry : topics}
                onChange={e => type === 'ai_news' ? setIndustry(e.target.value) : setTopics(e.target.value)} />
            </div>
          )}

          {type === 'product_ad' && (
            <>
              <div className="space-y-2"><Label>Product Name</Label><Input value={productName} onChange={e => setProductName(e.target.value)} /></div>
              <div className="space-y-2"><Label>What does it do?</Label>
                <textarea className="w-full min-h-20 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  value={productDescription} onChange={e => setProductDescription(e.target.value)} /></div>
              <div className="space-y-2"><Label>Pain points</Label><Input value={painPoints} onChange={e => setPainPoints(e.target.value)} /></div>
            </>
          )}

          <div className="space-y-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {toneOptions.map(t => (
                <button key={t} onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${tone === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Example posts (optional)</Label>
            <textarea className="w-full min-h-20 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              placeholder="Paste 1-2 example posts you like" value={contentExamples} onChange={e => setContentExamples(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="grid grid-cols-2 gap-2">
              {platformOptions.map(p => (
                <button key={p.id} onClick={() => togglePlatform(p.id)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${selectedPlatforms.includes(p.id) ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Schedule</Label>
            <div className="grid grid-cols-2 gap-2">
              {scheduleOptions.map(s => (
                <button key={s.id} onClick={() => setSelectedSchedule(s.id)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${selectedSchedule === s.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-sm font-medium">Include AI images</p><p className="text-xs text-muted-foreground">5 credits each</p></div>
              </div>
              <button onClick={() => setIncludeImages(!includeImages)}
                className={`w-10 h-6 rounded-full transition-colors ${includeImages ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${includeImages ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {autoPublish ? <Send className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                <div><p className="text-sm font-medium">{autoPublish ? 'Auto-publish' : 'Save as draft'}</p>
                  <p className="text-xs text-muted-foreground">{autoPublish ? 'Posts go live automatically' : 'Review before publishing'}</p></div>
              </div>
              <button onClick={() => setAutoPublish(!autoPublish)}
                className={`w-10 h-6 rounded-full transition-colors ${autoPublish ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${autoPublish ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>

          {/* Preview */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Preview Content</CardTitle>
              <CardDescription>See what this automation would generate. Does not deduct credits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={handlePreview} disabled={previewing} className="gap-2">
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {previewing ? 'Generating...' : 'Generate Preview'}
              </Button>
              {preview && (
                <div className="space-y-3 pt-2">
                  {preview.topic && (
                    <p className="text-xs text-muted-foreground">Topic: <span className="text-foreground font-medium">{preview.topic}</span></p>
                  )}
                  {preview.variants ? (
                    Object.entries(preview.variants).map(([platform, variant]) => (
                      <div key={platform} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                        <div className="text-xs font-medium text-primary capitalize">{platform}</div>
                        <p className="text-sm whitespace-pre-wrap">{variant.text}</p>
                        {(variant.hashtags?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {variant.hashtags!.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-lg border bg-muted/30"><p className="text-sm whitespace-pre-wrap">{preview.text}</p></div>
                  )}
                  {preview.imagePrompt && (
                    <div className="p-3 rounded-lg border border-dashed bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">AI Image:</p>
                      <p className="text-sm italic">{preview.imagePrompt}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" asChild className="flex-1"><Link href="/automations">Cancel</Link></Button>
            <Button onClick={handleSave} disabled={saving || !name} className="flex-1 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Rejection feedback dialog */}
      {rejectingPost && (
        <RejectFeedbackDialog
          postText={rejectingPost.text}
          ruleId={id}
          onSubmit={() => handleRejectDraft(rejectingPost.id)}
          onCancel={() => {
            handleRejectDraft(rejectingPost.id)
          }}
        />
      )}
    </div>
  )
}

// Expandable draft review card with full platform previews
function DraftReviewCard({
  post,
  onApprove,
  onReject,
}: {
  post: PostItem
  onApprove: (id: string) => void
  onReject: (post: PostItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState(post.platforms[0] || 'instagram')

  const platformText = post.variants?.[selectedPlatform]?.text || post.text
  const platformHashtags = post.variants?.[selectedPlatform]?.hashtags || []

  return (
    <Card className="overflow-hidden">
      {/* Collapsed view — preview */}
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex gap-3">
            {post.mediaUrls.length > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.mediaUrls[0]} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm line-clamp-2">{post.text}</p>
              <div className="flex items-center gap-2 mt-2">
                {post.platforms.map(p => (
                  <Badge key={p} variant="secondary" className="text-[10px] capitalize">{p}</Badge>
                ))}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(post.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="flex-shrink-0 self-center">
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </button>

        {/* Expanded view — full preview */}
        {expanded && (
          <div className="border-t">
            {/* Platform tabs */}
            {post.platforms.length > 1 && (
              <div className="flex border-b px-4 pt-3 gap-1">
                {post.platforms.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-all ${
                      selectedPlatform === p
                        ? 'bg-primary/10 text-primary border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* Phone mockup preview */}
            <div className="p-4 flex justify-center">
              <div className="w-full max-w-sm border rounded-2xl overflow-hidden bg-background shadow-lg">
                {/* Platform header */}
                <div className="p-3 border-b flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">S</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">socialfly</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{selectedPlatform}</p>
                  </div>
                </div>

                {/* Image */}
                {post.mediaUrls.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.mediaUrls[0]} alt="" className="w-full aspect-square object-cover" />
                )}

                {/* Post text */}
                <div className="p-3 space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{platformText}</p>

                  {platformHashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {platformHashtags.map(tag => (
                        <span key={tag} className="text-xs text-primary">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex gap-2">
              <Button size="sm" className="flex-1 gap-1" onClick={() => onApprove(post.id)}>
                <Send className="h-3 w-3" />Approve & Schedule
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1 text-destructive" onClick={() => onReject(post)}>
                <X className="h-3 w-3" />Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
