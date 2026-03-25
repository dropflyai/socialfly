'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Megaphone,
  Plus,
  Search,
  X,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Trash2,
  BarChart3,
  FileText,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Campaign {
  id: string
  name: string
  description: string | null
  status: string
  platforms: string[]
  start_date: string | null
  end_date: string | null
  post_ids: string[]
  post_count: number
  created_at: string
  updated_at: string
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Play }> = {
  active: { label: 'Active', color: 'text-emerald-500', icon: Play },
  paused: { label: 'Paused', color: 'text-yellow-500', icon: Pause },
  completed: { label: 'Completed', color: 'text-blue-500', icon: CheckCircle2 },
  draft: { label: 'Draft', color: 'text-muted-foreground', icon: FileText },
}

const platformColors: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-500',
  twitter: 'bg-sky-500/10 text-sky-500',
  tiktok: 'bg-gray-500/10 text-gray-300',
  facebook: 'bg-blue-500/10 text-blue-500',
  linkedin: 'bg-blue-700/10 text-blue-400',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPlatforms, setNewPlatforms] = useState<string[]>([])
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')

  const fetchCampaigns = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/campaigns?${params}`)
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      console.error('Failed to fetch campaigns:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
          platforms: newPlatforms,
          startDate: newStartDate || undefined,
          endDate: newEndDate || undefined,
        }),
      })

      if (res.ok) {
        setShowCreate(false)
        setNewName('')
        setNewDescription('')
        setNewPlatforms([])
        setNewStartDate('')
        setNewEndDate('')
        await fetchCampaigns()
      }
    } catch (err) {
      console.error('Failed to create campaign:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await fetchCampaigns()
    } catch (err) {
      console.error('Failed to update campaign:', err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' })
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error('Failed to delete campaign:', err)
    }
  }

  const togglePlatform = (platform: string) => {
    setNewPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return campaigns
    const q = searchQuery.toLowerCase()
    return campaigns.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    )
  }, [campaigns, searchQuery])

  const activeCampaigns = campaigns.filter((c) => c.status === 'active')
  const totalPosts = campaigns.reduce((sum, c) => sum + c.post_count, 0)

  if (loading) return <CampaignsSkeleton />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Group posts into campaigns to track performance
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Stats Row — varied card sizes per Design Brain */}
      {campaigns.length > 0 && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              <Megaphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaigns.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
              <Play className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCampaigns.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPosts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaigns.filter((c) => c.status === 'completed').length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {campaigns.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              className="pl-9 pr-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Campaign List */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Megaphone className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl mb-2">No campaigns yet</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">
              Create campaigns to group your posts, track performance,
              and measure the impact of your marketing efforts.
            </CardDescription>
            <Button className="gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create First Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No campaigns match your search.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearchQuery(''); setStatusFilter('all') }}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>
              Group posts together to track performance as a cohesive effort.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                placeholder="e.g. Summer Launch, Product Hunt Week"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What's this campaign about?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {['instagram', 'twitter', 'tiktok', 'facebook', 'linkedin'].map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      newPlatforms.includes(p)
                        ? platformColors[p] + ' ring-1 ring-current'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
              </div>
            </div>
            <Button className="w-full gap-2" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CampaignCard({
  campaign,
  onStatusChange,
  onDelete,
}: {
  campaign: Campaign
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const config = statusConfig[campaign.status] || statusConfig.draft
  const StatusIcon = config.icon

  return (
    <Card className="group relative overflow-hidden transition-all hover:border-primary/50">
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        campaign.status === 'active' ? 'bg-emerald-500' :
        campaign.status === 'paused' ? 'bg-yellow-500' :
        campaign.status === 'completed' ? 'bg-blue-500' : 'bg-muted'
      }`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{campaign.name}</h3>
              <Badge variant="outline" className={`gap-1 text-xs ${config.color}`}>
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{campaign.description}</p>
            )}
          </div>
          <button
            onClick={() => onDelete(campaign.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Platform badges */}
        {campaign.platforms.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {campaign.platforms.map((p) => (
              <span key={p} className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${platformColors[p] || 'bg-muted text-muted-foreground'}`}>
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {campaign.post_count} post{campaign.post_count !== 1 ? 's' : ''}
          </span>
          {campaign.start_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(campaign.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {campaign.end_date && (
                <> — {new Date(campaign.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
              )}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(campaign.created_at)}
          </span>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
          {campaign.status === 'active' && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onStatusChange(campaign.id, 'paused')}>
              <Pause className="h-3 w-3 mr-1" /> Pause
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onStatusChange(campaign.id, 'active')}>
              <Play className="h-3 w-3 mr-1" /> Resume
            </Button>
          )}
          {campaign.status !== 'completed' && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onStatusChange(campaign.id, 'completed')}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CampaignsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-72 bg-muted rounded mt-2" />
        </div>
        <div className="h-10 w-40 bg-muted rounded" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
