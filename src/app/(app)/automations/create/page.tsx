'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, Calendar, Newspaper, ShoppingBag, RefreshCw,
  Instagram, Facebook, ArrowLeft, Check, ImageIcon, Eye, Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const automationTypes = [
  {
    id: 'content_calendar',
    name: 'Content Calendar',
    description: 'AI generates branded social posts on your chosen topics',
    icon: Calendar,
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    id: 'ai_news',
    name: 'Industry News Posts',
    description: 'Auto-generate posts about trends and news in your industry',
    icon: Newspaper,
    color: 'text-purple-500 bg-purple-500/10',
  },
  {
    id: 'product_ad',
    name: 'Product Promotion',
    description: 'Generate pain-point based ads for your products with AI images',
    icon: ShoppingBag,
    color: 'text-green-500 bg-green-500/10',
  },
  {
    id: 'repurpose',
    name: 'Repurpose Top Posts',
    description: 'Automatically adapt your best-performing posts for other platforms',
    icon: RefreshCw,
    color: 'text-orange-500 bg-orange-500/10',
  },
]

const platformOptions = [
  { id: 'instagram', name: 'Instagram', icon: Instagram },
  { id: 'facebook', name: 'Facebook', icon: Facebook },
  { id: 'linkedin', name: 'LinkedIn', icon: Facebook },
  { id: 'tiktok', name: 'TikTok', icon: Instagram },
]

const schedules = [
  { id: 'daily', name: 'Daily', description: 'Runs every day' },
  { id: 'weekdays', name: 'Weekdays', description: 'Mon-Fri only' },
  { id: 'weekly', name: 'Weekly', description: 'Once per week' },
  { id: 'biweekly', name: 'Bi-weekly', description: 'Every 2 weeks' },
]

const toneOptions = [
  'Professional', 'Casual', 'Friendly', 'Witty', 'Inspirational', 'Educational', 'Bold', 'Conversational',
]

export default function CreateAutomationPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram'])
  const [selectedSchedule, setSelectedSchedule] = useState('daily')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Brand profiles
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string>('')

  useEffect(() => {
    fetch('/api/brand/analyze')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.brandProfiles?.length) {
          setBrands(data.brandProfiles.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })))
          setSelectedBrandId(data.brandProfiles[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // Content configuration
  const [topics, setTopics] = useState('')
  const [tone, setTone] = useState('Professional')
  const [includeImages, setIncludeImages] = useState(true)
  const [autoPublish, setAutoPublish] = useState(true)
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [painPoints, setPainPoints] = useState('')
  const [industry, setIndustry] = useState('')
  const [contentExamples, setContentExamples] = useState('')
  const [mediaSource, setMediaSource] = useState<'ai' | 'library' | 'none'>('ai')
  const [mediaPool, setMediaPool] = useState<{ id: string; url: string; name: string }[]>([])
  const [availableMedia, setAvailableMedia] = useState<{ id: string; url: string; name: string }[]>([])
  const [loadingMedia, setLoadingMedia] = useState(false)

  // Campaign fields
  const [isCampaign, setIsCampaign] = useState(false)
  const [campaignStart, setCampaignStart] = useState('')
  const [campaignEnd, setCampaignEnd] = useState('')
  const [campaignGoal, setCampaignGoal] = useState('')
  const [campaignGoalTarget, setCampaignGoalTarget] = useState('')

  const totalSteps = 5

  async function loadMediaLibrary() {
    if (availableMedia.length > 0) return
    setLoadingMedia(true)
    try {
      const res = await fetch('/api/media?type=image')
      if (res.ok) {
        const data = await res.json()
        setAvailableMedia((data.assets || []).map((a: { id: string; url: string; name: string }) => ({ id: a.id, url: a.url, name: a.name })))
      }
    } catch { /* ignore */ }
    setLoadingMedia(false)
  }

  function toggleMediaInPool(asset: { id: string; url: string; name: string }) {
    setMediaPool(prev =>
      prev.find(m => m.id === asset.id)
        ? prev.filter(m => m.id !== asset.id)
        : [...prev, asset]
    )
  }

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleCreate() {
    if (!name || !selectedType || !selectedPlatforms.length) return

    setCreating(true)
    setError(null)
    try {
      const config: Record<string, unknown> = {
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        tone,
        includeImages: mediaSource === 'ai',
        mediaSource,
        mediaPool: mediaSource === 'library' ? mediaPool.map(m => ({ id: m.id, url: m.url })) : undefined,
        autoPublish,
        contentExamples: contentExamples || undefined,
        industry: industry || undefined,
      }

      if (selectedType === 'product_ad') {
        config.product = productName
        config.productDescription = productDescription
        config.painPoints = painPoints.split(',').map(t => t.trim()).filter(Boolean)
      }

      if (selectedType === 'ai_news') {
        config.industry = industry
      }

      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: selectedType,
          config,
          platforms: selectedPlatforms,
          schedule: selectedSchedule,
          brandId: selectedBrandId || undefined,
          isCampaign,
          campaignStart: isCampaign && campaignStart ? new Date(campaignStart).toISOString() : undefined,
          campaignEnd: isCampaign && campaignEnd ? new Date(campaignEnd).toISOString() : undefined,
          campaignGoal: isCampaign && campaignGoal ? campaignGoal : undefined,
          campaignGoalTarget: isCampaign && campaignGoalTarget ? parseInt(campaignGoalTarget) : undefined,
        }),
      })

      if (res.ok) {
        router.push('/automations')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create automation')
      }
    } catch (e) {
      console.error('Create error:', e)
      setError('Something went wrong')
    }
    setCreating(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/automations"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Automation</h1>
          <p className="text-muted-foreground">Step {step} of {totalSteps}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Choose Type */}
      {step === 1 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">What should this automation do?</h2>
          {automationTypes.map(type => {
            const Icon = type.icon
            const isSelected = selectedType === type.id
            return (
              <Card
                key={type.id}
                className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
                onClick={() => setSelectedType(type.id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`rounded-lg p-3 ${type.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{type.name}</h3>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                  {isSelected && <Check className="h-5 w-5 text-primary" />}
                </CardContent>
              </Card>
            )
          })}
          <Button onClick={() => setStep(2)} disabled={!selectedType} className="w-full">
            Next
          </Button>
        </div>
      )}

      {/* Step 2: Configure Content */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Configure your content</h2>

          {/* Brand selector */}
          {brands.length > 0 && (
            <div className="space-y-2">
              <Label>Brand Profile</Label>
              <div className="grid gap-2">
                {brands.map(brand => (
                  <button
                    key={brand.id}
                    onClick={() => setSelectedBrandId(brand.id)}
                    className={`p-3 rounded-lg border text-sm font-medium text-left transition-all ${
                      selectedBrandId === brand.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                  >
                    {brand.name}
                    {selectedBrandId === brand.id && <Check className="h-4 w-4 text-primary inline ml-2" />}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Content will use this brand's voice, tone, and audience</p>
            </div>
          )}

          {/* Topics — shown for content_calendar and ai_news */}
          {(selectedType === 'content_calendar' || selectedType === 'ai_news') && (
            <div className="space-y-2">
              <Label>
                {selectedType === 'ai_news' ? 'Industry / Topics to cover' : 'Topics & Themes'}
              </Label>
              <Input
                placeholder="e.g., AI tools, productivity tips, startup advice, marketing"
                value={selectedType === 'ai_news' ? industry : topics}
                onChange={e => selectedType === 'ai_news' ? setIndustry(e.target.value) : setTopics(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate multiple topics with commas</p>
            </div>
          )}

          {selectedType === 'content_calendar' && (
            <div className="space-y-2">
              <Label>Topics to post about</Label>
              <Input
                placeholder="e.g., social media tips, AI tools, content creation, marketing"
                value={topics}
                onChange={e => setTopics(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate with commas. AI will rotate through these.</p>
            </div>
          )}

          {/* Product fields — shown for product_ad */}
          {selectedType === 'product_ad' && (
            <>
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  placeholder="e.g., SocialFly, VoiceFly"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>What does it do?</Label>
                <textarea
                  className="w-full min-h-20 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  placeholder="e.g., AI-powered social media management that creates and publishes content automatically"
                  value={productDescription}
                  onChange={e => setProductDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Customer pain points to address</Label>
                <Input
                  placeholder="e.g., no time to post, inconsistent branding, low engagement"
                  value={painPoints}
                  onChange={e => setPainPoints(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Separate with commas. Each post will focus on one.</p>
              </div>
            </>
          )}

          {/* Tone selector */}
          <div className="space-y-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {toneOptions.map(t => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    tone === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Content examples */}
          <div className="space-y-2">
            <Label>Example posts (optional)</Label>
            <textarea
              className="w-full min-h-20 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              placeholder="Paste 1-2 example posts you like. AI will match this style."
              value={contentExamples}
              onChange={e => setContentExamples(e.target.value)}
            />
          </div>

          {/* Media source */}
          <div className="space-y-2">
            <Label>Images for posts</Label>
            <div className="grid gap-2">
              <button
                onClick={() => setMediaSource('ai')}
                className={`p-3 rounded-lg border text-left transition-all ${mediaSource === 'ai' ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}
              >
                <p className="text-sm font-medium">AI-generated images</p>
                <p className="text-xs text-muted-foreground">AI creates a unique image for each post (5 credits each)</p>
              </button>
              <button
                onClick={() => { setMediaSource('library'); loadMediaLibrary() }}
                className={`p-3 rounded-lg border text-left transition-all ${mediaSource === 'library' ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}
              >
                <p className="text-sm font-medium">My media library</p>
                <p className="text-xs text-muted-foreground">Pick images from your uploads to rotate through</p>
              </button>
              <button
                onClick={() => setMediaSource('none')}
                className={`p-3 rounded-lg border text-left transition-all ${mediaSource === 'none' ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}
              >
                <p className="text-sm font-medium">Text only</p>
                <p className="text-xs text-muted-foreground">No images — just text posts</p>
              </button>
            </div>
          </div>

          {/* Media pool picker */}
          {mediaSource === 'library' && (
            <div className="space-y-2">
              <Label>Select images to rotate ({mediaPool.length} selected)</Label>
              {loadingMedia ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading media...</div>
              ) : availableMedia.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No images in your library. <a href="/media" className="text-primary underline">Upload some first</a>.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {availableMedia.map(asset => {
                    const selected = mediaPool.find(m => m.id === asset.id)
                    return (
                      <button
                        key={asset.id}
                        onClick={() => toggleMediaInPool(asset)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-square ${selected ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-primary/30'}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                        {selected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <Check className="h-5 w-5 text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-3">

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {autoPublish ? <Send className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">{autoPublish ? 'Auto-publish' : 'Save as draft'}</p>
                  <p className="text-xs text-muted-foreground">
                    {autoPublish ? 'Posts go live automatically' : 'Review posts before publishing'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAutoPublish(!autoPublish)}
                className={`w-10 h-6 rounded-full transition-colors ${autoPublish ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${autoPublish ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(3)} className="flex-1">Next</Button>
          </div>
        </div>
      )}

      {/* Step 3: Choose Platforms */}
      {step === 3 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Which platforms?</h2>
          <div className="grid gap-3 grid-cols-2">
            {platformOptions.map(platform => {
              const Icon = platform.icon
              const isSelected = selectedPlatforms.includes(platform.id)
              return (
                <Card
                  key={platform.id}
                  className={`cursor-pointer transition-all text-center ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}
                  onClick={() => togglePlatform(platform.id)}
                >
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <Icon className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">{platform.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(4)} disabled={!selectedPlatforms.length} className="flex-1">Next</Button>
          </div>
        </div>
      )}

      {/* Step 4: Choose Schedule */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">How often?</h2>
          {schedules.map(sched => (
            <Card
              key={sched.id}
              className={`cursor-pointer transition-all ${selectedSchedule === sched.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
              onClick={() => setSelectedSchedule(sched.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{sched.name}</h3>
                  <p className="text-sm text-muted-foreground">{sched.description}</p>
                </div>
                {selectedSchedule === sched.id && <Check className="h-5 w-5 text-primary" />}
              </CardContent>
            </Card>
          ))}

          {/* Campaign toggle */}
          <div className="pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Make this a campaign</p>
                  <p className="text-xs text-muted-foreground">Set a start date, end date, and goal</p>
                </div>
              </div>
              <button
                onClick={() => setIsCampaign(!isCampaign)}
                className={`w-10 h-6 rounded-full transition-colors ${isCampaign ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${isCampaign ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>

          {isCampaign && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={campaignStart} onChange={e => setCampaignStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={campaignEnd} onChange={e => setCampaignEnd(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Campaign Goal</Label>
                <select
                  value={campaignGoal}
                  onChange={e => setCampaignGoal(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                >
                  <option value="">Select a goal...</option>
                  <option value="engagement">Increase Engagement</option>
                  <option value="followers">Grow Followers</option>
                  <option value="awareness">Brand Awareness</option>
                  <option value="traffic">Drive Traffic</option>
                  <option value="sales">Drive Sales</option>
                  <option value="launch">Product Launch</option>
                  <option value="event">Event Promotion</option>
                </select>
              </div>
              {campaignGoal && (
                <div className="space-y-1">
                  <Label className="text-xs">Target (optional)</Label>
                  <Input
                    type="number"
                    placeholder={campaignGoal === 'followers' ? 'e.g., 500 new followers' : campaignGoal === 'traffic' ? 'e.g., 1000 clicks' : 'e.g., 100'}
                    value={campaignGoalTarget}
                    onChange={e => setCampaignGoalTarget(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(5)} className="flex-1">Next</Button>
          </div>
        </div>
      )}

      {/* Step 5: Name & Confirm */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Name your automation</h2>
          <Input
            placeholder="e.g., Daily AI News Posts"
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-lg"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedBrandId && brands.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Brand</span>
                  <span className="font-medium">{brands.find(b => b.id === selectedBrandId)?.name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <Badge>{automationTypes.find(t => t.id === selectedType)?.name}</Badge>
              </div>
              {topics && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Topics</span>
                  <span className="text-right max-w-[60%] truncate">{topics}</span>
                </div>
              )}
              {industry && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Industry</span>
                  <span>{industry}</span>
                </div>
              )}
              {productName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Product</span>
                  <span>{productName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tone</span>
                <span>{tone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platforms</span>
                <span>{selectedPlatforms.join(', ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Schedule</span>
                <span>{schedules.find(s => s.id === selectedSchedule)?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AI Images</span>
                <span>{includeImages ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Publishing</span>
                <span>{autoPublish ? 'Auto-publish' : 'Draft for review'}</span>
              </div>
              {isCampaign && (
                <>
                  <div className="pt-2 border-t">
                    <Badge variant="outline" className="mb-2">Campaign</Badge>
                  </div>
                  {campaignStart && campaignEnd && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{new Date(campaignStart).toLocaleDateString()} — {new Date(campaignEnd).toLocaleDateString()}</span>
                    </div>
                  )}
                  {campaignGoal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Goal</span>
                      <span className="capitalize">{campaignGoal.replace(/_/g, ' ')}{campaignGoalTarget ? ` (${campaignGoalTarget})` : ''}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(4)} className="flex-1">Back</Button>
            <Button onClick={handleCreate} disabled={!name || creating} className="flex-1 gap-2">
              {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Automation'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
