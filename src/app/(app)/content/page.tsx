'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Plus,
  Search,
  Image,
  Video,
  Type,
  Clock,
  Check,
  ExternalLink,
  X,
  RefreshCw,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createBrowserClient } from '@/lib/supabase-client'

interface ContentItem {
  id: string
  title: string
  body: string
  content_type: string
  platform_variants: Record<string, string> | null
  media_urls: string[] | null
  token_usage: number | null
  created_at: string
  updated_at: string
}

interface ScheduledPost {
  id: string
  content_item_id: string | null
  platforms: string[]
  caption: string | null
  status: string
  posted_at: string | null
  scheduled_for: string | null
  error_message: string | null
  created_at: string
}

type ContentFilter = 'all' | 'text' | 'image' | 'video'
type SortOrder = 'newest' | 'oldest'

export default function ContentPage() {
  const supabase = createBrowserClient()
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [postedItems, setPostedItems] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [contentResult, postsResult] = await Promise.all([
        supabase
          .from('content_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('scheduled_posts')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'posted')
          .order('posted_at', { ascending: false })
          .limit(50),
      ])

      if (contentResult.data) {
        setContentItems(contentResult.data)
      }
      if (postsResult.data) {
        setPostedItems(postsResult.data)
      }
    } catch (error) {
      console.error('Failed to load content:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredContent = useMemo(() => {
    let items = [...contentItems]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q)
      )
    }

    if (contentFilter !== 'all') {
      items = items.filter((item) => item.content_type === contentFilter)
    }

    if (sortOrder === 'oldest') {
      items.reverse()
    }

    return items
  }, [contentItems, searchQuery, contentFilter, sortOrder])

  if (loading) {
    return <ContentSkeleton />
  }

  const hasContent = contentItems.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Library</h1>
          <p className="text-muted-foreground">
            {hasContent
              ? `${contentItems.length} piece${contentItems.length !== 1 ? 's' : ''} of content`
              : 'Create, manage, and organize your content'}
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/content/create">
            <Plus className="h-4 w-4" />
            Create Content
          </Link>
        </Button>
      </div>

      {hasContent ? (
        <>
          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or content..."
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
            <div className="flex items-center gap-2">
              <Select
                value={contentFilter}
                onValueChange={(v) => setContentFilter(v as ContentFilter)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortOrder}
                onValueChange={(v) => setSortOrder(v as SortOrder)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content Grid */}
          {filteredContent.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredContent.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedId === item.id}
                  onToggle={() =>
                    setExpandedId(expandedId === item.id ? null : item.id)
                  }
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No content matches your search or filters.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setSearchQuery('')
                    setContentFilter('all')
                  }}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Post History */}
          {postedItems.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">
                  Post History
                </h2>
                <Badge variant="secondary">{postedItems.length} posted</Badge>
              </div>
              <div className="space-y-2">
                {postedItems.map((post) => (
                  <PostHistoryRow key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl mb-2">No content yet</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">
              Your content library is empty. Create your first piece of content
              with AI assistance and it will appear here.
            </CardDescription>
            <Button asChild className="gap-2">
              <Link href="/content/create">
                <Sparkles className="h-4 w-4" />
                Create with AI
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ContentCard({
  item,
  isExpanded,
  onToggle,
}: {
  item: ContentItem
  isExpanded: boolean
  onToggle: () => void
}) {
  const typeIcon = getTypeIcon(item.content_type)
  const platformVariantKeys = item.platform_variants
    ? Object.keys(item.platform_variants)
    : []
  const hasThumbnail = item.media_urls && item.media_urls.length > 0
  const preview = item.body.length > 120
    ? item.body.slice(0, 120) + '...'
    : item.body

  return (
    <Card
      className={`cursor-pointer transition-all hover:border-primary/50 ${
        isExpanded ? 'ring-2 ring-primary md:col-span-2' : ''
      }`}
      onClick={onToggle}
    >
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {hasThumbnail && (
            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
              <img
                src={item.media_urls![0]}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium truncate">{item.title}</h3>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
            {!isExpanded && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {preview}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className="gap-1 text-xs">
                {typeIcon}
                {item.content_type}
              </Badge>
              {platformVariantKeys.slice(0, 3).map((platform) => (
                <Badge key={platform} variant="outline" className="text-xs capitalize">
                  {platform}
                </Badge>
              ))}
              {platformVariantKeys.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{platformVariantKeys.length - 3}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(item.created_at)}
              </span>
              {item.token_usage != null && item.token_usage > 0 && (
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {item.token_usage.toLocaleString()} tokens
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expanded view */}
        {isExpanded && (
          <div className="border-t px-4 py-4 space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Full Content</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {item.body}
              </p>
            </div>

            {hasThumbnail && item.media_urls!.length > 1 && (
              <div>
                <p className="text-sm font-medium mb-2">Media</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {item.media_urls!.map((url, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted"
                    >
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {platformVariantKeys.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Platform Variants</p>
                {platformVariantKeys.map((platform) => (
                  <div key={platform} className="space-y-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {platform}
                    </Badge>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-1">
                      {item.platform_variants![platform]}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button size="sm" asChild>
                <Link href="/content/create">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Create Similar
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PostHistoryRow({ post }: { post: ScheduledPost }) {
  const isSuccess = !post.error_message
  const displayDate = post.posted_at || post.scheduled_for || post.created_at
  const captionPreview = post.caption
    ? post.caption.length > 100
      ? post.caption.slice(0, 100) + '...'
      : post.caption
    : 'No caption'

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isSuccess
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'bg-destructive/10 text-destructive'
        }`}
      >
        {isSuccess ? (
          <Check className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{captionPreview}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatDate(displayDate)}
          </span>
          {post.platforms && post.platforms.length > 0 && (
            <div className="flex gap-1">
              {post.platforms.map((p) => (
                <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {post.error_message && (
          <p className="text-xs text-destructive mt-0.5 truncate">
            {post.error_message}
          </p>
        )}
      </div>
      <Badge
        variant={isSuccess ? 'secondary' : 'destructive'}
        className="text-xs flex-shrink-0"
      >
        {isSuccess ? 'Posted' : 'Failed'}
      </Badge>
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-muted rounded" />
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 max-w-sm bg-muted rounded" />
        <div className="h-9 w-[130px] bg-muted rounded" />
        <div className="h-9 w-[130px] bg-muted rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'image':
      return <Image className="h-3 w-3" />
    case 'video':
      return <Video className="h-3 w-3" />
    default:
      return <Type className="h-3 w-3" />
  }
}

function formatDate(isoString: string) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
