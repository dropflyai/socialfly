'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Zap, Plus, Play, Pause, History, Trash2, Clock, Calendar, Edit, Check, X, Send, Pencil,
  Instagram, Facebook, Twitter, RefreshCw, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface AutomationRule {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  platforms: string[]
  schedule: string
  status: string
  last_run: string | null
  run_count: number
  created_at: string
}

const typeLabels: Record<string, { label: string; color: string }> = {
  content_calendar: { label: 'Content Calendar', color: 'bg-blue-100 text-blue-800' },
  ai_news: { label: 'AI News Posts', color: 'bg-purple-100 text-purple-800' },
  product_ad: { label: 'Product Ads', color: 'bg-green-100 text-green-800' },
  repurpose: { label: 'Repurpose Top Posts', color: 'bg-orange-100 text-orange-800' },
  custom: { label: 'Custom', color: 'bg-gray-100 text-gray-800' },
}

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
}

interface DraftPost {
  id: string
  platforms: string[]
  custom_content: {
    text: string
    media_urls?: string[]
    automation_type?: string
    variants?: Record<string, { text: string; hashtags?: string[] }>
  }
  created_at: string
}

export default function AutomationsPage() {
  const router = useRouter()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [drafts, setDrafts] = useState<DraftPost[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchRules() {
    setLoading(true)
    try {
      const [rulesRes, draftsRes] = await Promise.all([
        fetch('/api/automations'),
        fetch('/api/posts/schedule?status=draft'),
      ])
      if (rulesRes.ok) {
        const data = await rulesRes.json()
        setRules(data.rules || [])
      }
      if (draftsRes.ok) {
        const data = await draftsRes.json()
        setDrafts((data.posts || []).filter((p: DraftPost) => p.custom_content?.automation_type))
      }
    } catch (e) {
      console.error('Fetch error:', e)
    }
    setLoading(false)
  }

  async function approveDraft(postId: string) {
    await fetch(`/api/posts/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        action: 'approve',
      }),
    })
    // Move from draft to scheduled
    // For now, update directly via schedule API
    await fetch(`/api/posts/schedule?id=${postId}&action=approve`, { method: 'PATCH' })
    fetchRules()
  }

  async function rejectDraft(postId: string) {
    await fetch(`/api/posts/schedule?id=${postId}`, { method: 'DELETE' })
    fetchRules()
  }

  async function toggleRule(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await fetch(`/api/automations?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchRules()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this automation rule?')) return
    await fetch(`/api/automations?id=${id}`, { method: 'DELETE' })
    fetchRules()
  }

  useEffect(() => { fetchRules() }, [])

  const activeRules = rules.filter(r => r.status === 'active')
  const pausedRules = rules.filter(r => r.status === 'paused')

  function RuleCard({ rule }: { rule: AutomationRule }) {
    const typeInfo = typeLabels[rule.type] || typeLabels.custom
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <h3 className="font-semibold">{rule.name}</h3>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={typeInfo.color}>{typeInfo.label}</Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {rule.schedule}
                </Badge>
                {rule.platforms.map(p => {
                  const Icon = platformIcons[p] || Zap
                  return <Icon key={p} className="h-4 w-4 text-muted-foreground" />
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Runs: {rule.run_count}</span>
                {rule.last_run && (
                  <span>Last: {new Date(rule.last_run).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/automations/${rule.id}`)}
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleRule(rule.id, rule.status)}
                title={rule.status === 'active' ? 'Pause' : 'Activate'}
              >
                {rule.status === 'active' ? (
                  <ToggleRight className="h-5 w-5 text-green-500" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteRule(rule.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
          <p className="text-muted-foreground">Set rules to run your social media on autopilot</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchRules} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild className="gap-2">
            <Link href="/automations/create">
              <Plus className="h-4 w-4" />
              Create Rule
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue={drafts.length > 0 ? 'pending' : 'active'} className="space-y-6">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Play className="h-4 w-4" />
            Active ({activeRules.length})
          </TabsTrigger>
          {drafts.length > 0 && (
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending Review ({drafts.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="paused" className="gap-2">
            <Pause className="h-4 w-4" />
            Paused ({pausedRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {activeRules.length > 0 ? (
            activeRules.map(rule => <RuleCard key={rule.id} rule={rule} />)
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">No active automations</CardTitle>
                <CardDescription className="text-center max-w-sm mb-6">
                  Create automation rules to post content, generate ideas, or repurpose top performers automatically.
                </CardDescription>
                <Button asChild className="gap-2">
                  <Link href="/automations/create">
                    <Plus className="h-4 w-4" />
                    Create your first automation
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {drafts.length > 0 && (
          <TabsContent value="pending" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review AI-generated posts before they go live. Edit the text if needed, then approve or reject.
            </p>
            {drafts.map(draft => (
              <DraftCard key={draft.id} draft={draft} onApprove={approveDraft} onReject={rejectDraft} onRefresh={fetchRules} />
            ))}
          </TabsContent>
        )}

        <TabsContent value="paused" className="space-y-3">
          {pausedRules.length > 0 ? (
            pausedRules.map(rule => <RuleCard key={rule.id} rule={rule} />)
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Pause className="h-8 w-8 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">No paused rules</CardTitle>
                <CardDescription>Paused automation rules will appear here</CardDescription>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DraftCard({
  draft,
  onApprove,
  onReject,
  onRefresh,
}: {
  draft: DraftPost
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(draft.custom_content.text)
  const [saving, setSaving] = useState(false)
  const variants = draft.custom_content.variants as Record<string, { text: string; hashtags?: string[] }> | undefined

  async function handleSaveEdit() {
    setSaving(true)
    await fetch(`/api/posts/schedule?id=${draft.id}&action=edit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editText }),
    })
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  return (
    <Card className="overflow-hidden">
      {/* Image preview */}
      {draft.custom_content.media_urls?.length ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.custom_content.media_urls[0]}
            alt=""
            className="w-full h-48 object-cover"
          />
          {draft.custom_content.media_urls.length > 1 && (
            <Badge className="absolute top-2 right-2" variant="secondary">
              +{draft.custom_content.media_urls.length - 1} more
            </Badge>
          )}
        </div>
      ) : null}

      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">
              {draft.custom_content.automation_type?.replace(/_/g, ' ') || 'Automation'}
            </Badge>
            {draft.platforms.map(p => (
              <Badge key={p} variant="secondary" className="text-xs capitalize">{p}</Badge>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(draft.created_at).toLocaleDateString()} {new Date(draft.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Post text */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full min-h-32 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              value={editText}
              onChange={e => setEditText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="gap-1">
                {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditText(draft.custom_content.text) }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <p className="text-sm whitespace-pre-wrap">
              {draft.custom_content.text}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-0 right-0 gap-1 text-xs"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>
        )}

        {/* Platform variants (expandable) */}
        {variants && Object.keys(variants).length > 1 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide' : 'Show'} platform versions ({Object.keys(variants).length})
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {Object.entries(variants).map(([platform, variant]) => (
                  <div key={platform} className="p-2 rounded border bg-muted/30">
                    <div className="text-xs font-medium text-primary capitalize mb-1">{platform}</div>
                    <p className="text-xs whitespace-pre-wrap">{variant.text}</p>
                    {variant.hashtags?.length ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {variant.hashtags.map(tag => (
                          <span key={tag} className="text-[10px] text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1 gap-1" onClick={() => onApprove(draft.id)}>
            <Send className="h-3 w-3" />
            Approve & Schedule
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1 text-destructive" onClick={() => onReject(draft.id)}>
            <X className="h-3 w-3" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
