'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Loader2, ImageIcon, Eye, Send, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

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

interface AutomationData {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  platforms: string[]
  schedule: string
  status: string
  run_count: number
  created_at: string
}

export default function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState('')
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

  useEffect(() => {
    async function fetchAutomation() {
      try {
        const res = await fetch('/api/automations')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        const rule = (data.rules || []).find((r: AutomationData) => r.id === id)
        if (!rule) { router.push('/automations'); return }

        setName(rule.name)
        setType(rule.type)
        setSelectedPlatforms(rule.platforms || [])
        setSelectedSchedule(rule.schedule || 'daily')

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
    fetchAutomation()
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
      tone,
      includeImages,
      autoPublish,
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
        body: JSON.stringify({
          name,
          config,
          platforms: selectedPlatforms,
          schedule: selectedSchedule,
        }),
      })

      if (res.ok) {
        router.push('/automations')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save')
      }
    } catch {
      setError('Something went wrong')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this automation? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/automations?id=${id}`, { method: 'DELETE' })
    router.push('/automations')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/automations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Automation</h1>
            <p className="text-muted-foreground capitalize">{type?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-2">
          <Trash2 className="h-4 w-4" />
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} />
      </div>

      {/* Topics */}
      {(type === 'content_calendar' || type === 'ai_news') && (
        <div className="space-y-2">
          <Label>{type === 'ai_news' ? 'Industry / Topics' : 'Topics & Themes'}</Label>
          <Input
            placeholder="e.g., AI tools, productivity tips, marketing"
            value={type === 'ai_news' ? industry : topics}
            onChange={e => type === 'ai_news' ? setIndustry(e.target.value) : setTopics(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Separate with commas</p>
        </div>
      )}

      {/* Product fields */}
      {type === 'product_ad' && (
        <>
          <div className="space-y-2">
            <Label>Product Name</Label>
            <Input value={productName} onChange={e => setProductName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>What does it do?</Label>
            <textarea
              className="w-full min-h-20 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              value={productDescription}
              onChange={e => setProductDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Pain points</Label>
            <Input value={painPoints} onChange={e => setPainPoints(e.target.value)} />
          </div>
        </>
      )}

      {/* Tone */}
      <div className="space-y-2">
        <Label>Tone</Label>
        <div className="flex flex-wrap gap-2">
          {toneOptions.map(t => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                tone === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
          placeholder="Paste 1-2 example posts you like"
          value={contentExamples}
          onChange={e => setContentExamples(e.target.value)}
        />
      </div>

      {/* Platforms */}
      <div className="space-y-2">
        <Label>Platforms</Label>
        <div className="grid grid-cols-2 gap-2">
          {platformOptions.map(p => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                selectedPlatforms.includes(p.id) ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div className="space-y-2">
        <Label>Schedule</Label>
        <div className="grid grid-cols-2 gap-2">
          {scheduleOptions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSchedule(s.id)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                selectedSchedule === s.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Include AI images</p>
              <p className="text-xs text-muted-foreground">5 credits each</p>
            </div>
          </div>
          <button
            onClick={() => setIncludeImages(!includeImages)}
            className={`w-10 h-6 rounded-full transition-colors ${includeImages ? 'bg-primary' : 'bg-muted'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${includeImages ? 'translate-x-4' : ''}`} />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            {autoPublish ? <Send className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">{autoPublish ? 'Auto-publish' : 'Save as draft'}</p>
              <p className="text-xs text-muted-foreground">
                {autoPublish ? 'Posts go live automatically' : 'Review before publishing'}
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

      {/* Save */}
      <div className="flex gap-2">
        <Button variant="outline" asChild className="flex-1">
          <Link href="/automations">Cancel</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving || !name} className="flex-1 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
