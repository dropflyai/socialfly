'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LayoutTemplate,
  Plus,
  Search,
  X,
  Trash2,
  Copy,
  Clock,
  Tag,
  Code2,
  Hash,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

interface ContentTemplate {
  id: string
  name: string
  description: string | null
  platform: string
  content_type: string
  template: string
  variables: string[]
  tags: string[]
  usage_count: number
  created_at: string
}

const platformLabels: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

const platformColors: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-500',
  twitter: 'bg-sky-500/10 text-sky-500',
  tiktok: 'bg-gray-500/10 text-gray-300',
  facebook: 'bg-blue-500/10 text-blue-500',
  linkedin: 'bg-blue-700/10 text-blue-400',
}

const contentTypeLabels: Record<string, string> = {
  text: 'Text Post',
  image_caption: 'Image Caption',
  video_script: 'Video Script',
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ContentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<ContentTemplate | null>(null)

  // Create form
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPlatform, setNewPlatform] = useState('instagram')
  const [newContentType, setNewContentType] = useState('text')
  const [newTemplate, setNewTemplate] = useState('')
  const [newTags, setNewTags] = useState('')

  const fetchTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (platformFilter !== 'all') params.set('platform', platformFilter)

      const res = await fetch(`/api/templates?${params}`)
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    } finally {
      setLoading(false)
    }
  }, [platformFilter])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleCreate = async () => {
    if (!newName.trim() || !newTemplate.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
          platform: newPlatform,
          contentType: newContentType,
          template: newTemplate,
          tags: newTags ? newTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        }),
      })

      if (res.ok) {
        setShowCreate(false)
        resetForm()
        await fetchTemplates()
      }
    } catch (err) {
      console.error('Failed to create template:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (previewTemplate?.id === id) setPreviewTemplate(null)
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  const resetForm = () => {
    setNewName('')
    setNewDescription('')
    setNewPlatform('instagram')
    setNewContentType('text')
    setNewTemplate('')
    setNewTags('')
  }

  // Extract detected variables from the create form template
  const detectedVariables = useMemo(() => {
    const matches = newTemplate.match(/\{\{(\w+)\}\}/g) || []
    return [...new Set(matches.map((v) => v.replace(/\{\{|\}\}/g, '')))]
  }, [newTemplate])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return templates
    const q = searchQuery.toLowerCase()
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.template.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }, [templates, searchQuery])

  if (loading) return <TemplatesSkeleton />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Templates</h1>
          <p className="text-muted-foreground">
            Reusable post formats with {'{{variables}}'} for quick content creation
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      {templates.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
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
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {Object.entries(platformLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Template Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setPreviewTemplate(template)}
              onDelete={() => handleDelete(template.id)}
            />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <LayoutTemplate className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl mb-2">No templates yet</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">
              Create reusable templates with {'{{variables}}'} for recurring post formats
              like Feature Friday, Customer Spotlight, or Weekly Tips.
            </CardDescription>
            <Button className="gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No templates match your search.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearchQuery(''); setPlatformFilter('all') }}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
            <DialogDescription>
              Use {'{{variable_name}}'} syntax for dynamic parts that change each time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. Feature Friday, Customer Spotlight"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(platformLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select value={newContentType} onValueChange={setNewContentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(contentTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Template Body</Label>
              <Textarea
                placeholder={"Did you know {{product_name}} can {{feature}}?\n\n{{benefit}} — try it today!\n\n#{{hashtag}}"}
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
                rows={5}
                className="font-mono text-sm"
              />
              {detectedVariables.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs text-muted-foreground">Variables:</span>
                  {detectedVariables.map((v) => (
                    <Badge key={v} variant="secondary" className="text-xs font-mono">
                      <Code2 className="h-2.5 w-2.5 mr-1" />
                      {v}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                placeholder="e.g. product, weekly, engagement"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
              />
            </div>
            <Button className="w-full gap-2" onClick={handleCreate} disabled={!newName.trim() || !newTemplate.trim() || creating}>
              {creating ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        {previewTemplate && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{previewTemplate.name}</DialogTitle>
              <DialogDescription>
                {contentTypeLabels[previewTemplate.content_type] || previewTemplate.content_type} for {platformLabels[previewTemplate.platform]}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted/50 p-4 font-mono text-sm whitespace-pre-wrap">
              {previewTemplate.template}
            </div>
            {previewTemplate.variables.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewTemplate.variables.map((v) => (
                    <Badge key={v} variant="outline" className="font-mono text-xs">
                      {'{{' + v + '}}'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {previewTemplate.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                  </Badge>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                Used {previewTemplate.usage_count}x
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => { handleDelete(previewTemplate.id); setPreviewTemplate(null) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function TemplateCard({
  template,
  onPreview,
  onDelete,
}: {
  template: ContentTemplate
  onPreview: () => void
  onDelete: () => void
}) {
  const preview = template.template.length > 100
    ? template.template.slice(0, 100) + '...'
    : template.template

  return (
    <Card
      className="group cursor-pointer transition-all hover:border-primary/50"
      onClick={onPreview}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium truncate">{template.name}</h3>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground font-mono line-clamp-3 mb-3">{preview}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${platformColors[template.platform] || 'bg-muted text-muted-foreground'}`}>
            {template.platform}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {contentTypeLabels[template.content_type] || template.content_type}
          </Badge>
          {template.variables.length > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Code2 className="h-2.5 w-2.5" />
              {template.variables.length} var{template.variables.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" />
            Used {template.usage_count}x
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {formatDate(template.created_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function TemplatesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-52 bg-muted rounded" />
          <div className="h-4 w-80 bg-muted rounded mt-2" />
        </div>
        <div className="h-10 w-40 bg-muted rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 bg-muted rounded-lg" />
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
  })
}
