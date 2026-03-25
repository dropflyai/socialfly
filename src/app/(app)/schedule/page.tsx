'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  Check,
  X,
  RefreshCw,
  Trash2,
  Eye,
  MessageSquare,
  Heart,
  Plus,
  AlertCircle,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Platform icon components
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  twitter: TwitterIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'text-pink-500',
  facebook: 'text-blue-600',
  twitter: 'text-foreground',
  linkedin: 'text-blue-500',
  tiktok: 'text-foreground',
}

interface ContentItem {
  id: string
  title: string | null
  body: string | null
  media_urls: string[]
  thumbnail_url: string | null
  hashtags: string[]
  content_type: string
}

interface ScheduledPost {
  id: string
  user_id: string
  content_id: string | null
  brand_id: string | null
  platforms: string[]
  scheduled_for: string
  timezone: string
  status: string
  posted_at: string | null
  platform_post_ids: Record<string, string>
  platform_errors: Record<string, string>
  retry_count: number
  max_retries: number
  custom_content: { caption?: string; media_urls?: string[] } | null
  created_at: string
  updated_at: string
  content_items: ContentItem | null
}

export default function SchedulePage() {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [publishedPosts, setPublishedPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('upcoming')
  const [weekOffset, setWeekOffset] = useState(0)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const [scheduledRes, publishedRes] = await Promise.all([
        fetch('/api/posts/schedule?status=scheduled'),
        fetch('/api/posts/schedule?status=posted'),
      ])

      const scheduledData = await scheduledRes.json()
      const publishedData = await publishedRes.json()

      setScheduledPosts(scheduledData.posts || [])
      setPublishedPosts(publishedData.posts || [])
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleCancel = async (postId: string) => {
    setCancelling(postId)
    try {
      const res = await fetch(`/api/posts/schedule?id=${postId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setScheduledPosts((prev) => prev.filter((p) => p.id !== postId))
      }
    } catch (error) {
      console.error('Failed to cancel post:', error)
    } finally {
      setCancelling(null)
    }
  }

  // Sort published posts by posted_at descending
  const sortedPublished = useMemo(
    () =>
      [...publishedPosts].sort((a, b) => {
        const dateA = a.posted_at ? new Date(a.posted_at).getTime() : 0
        const dateB = b.posted_at ? new Date(b.posted_at).getTime() : 0
        return dateB - dateA
      }),
    [publishedPosts]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">Plan and manage your posting calendar</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchPosts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild className="gap-2">
            <Link href="/content/create">
              <Plus className="h-4 w-4" />
              Schedule Post
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming" className="gap-2">
            <Clock className="h-4 w-4" />
            Upcoming
            {scheduledPosts.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                {scheduledPosts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="published" className="gap-2">
            <Check className="h-4 w-4" />
            Published
            {publishedPosts.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                {publishedPosts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming" className="space-y-6">
          {loading ? (
            <PostsSkeleton />
          ) : scheduledPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">No posts scheduled</CardTitle>
                <CardDescription className="text-center max-w-sm mb-6">
                  Schedule posts to auto-publish across your social accounts at the best times.
                </CardDescription>
                <Button asChild className="gap-2">
                  <Link href="/content/create">
                    <Plus className="h-4 w-4" />
                    Schedule your first post
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Week Calendar View */}
              <WeekCalendar
                posts={scheduledPosts}
                weekOffset={weekOffset}
                onPrevWeek={() => setWeekOffset((w) => w - 1)}
                onNextWeek={() => setWeekOffset((w) => w + 1)}
                onToday={() => setWeekOffset(0)}
              />

              {/* Post Cards */}
              <div className="space-y-3">
                {scheduledPosts.map((post) => (
                  <ScheduledPostCard
                    key={post.id}
                    post={post}
                    onCancel={handleCancel}
                    cancelling={cancelling === post.id}
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Published Tab */}
        <TabsContent value="published" className="space-y-6">
          {loading ? (
            <PostsSkeleton />
          ) : sortedPublished.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">No published posts yet</CardTitle>
                <CardDescription className="text-center max-w-sm mb-6">
                  Once your scheduled posts go live, they will appear here with engagement metrics.
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedPublished.map((post) => (
                <PublishedPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// --- Week Calendar ---

function WeekCalendar({
  posts,
  weekOffset,
  onPrevWeek,
  onNextWeek,
  onToday,
}: {
  posts: ScheduledPost[]
  weekOffset: number
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Calculate the start of the week (Monday)
  const startOfWeek = new Date(today)
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  startOfWeek.setDate(today.getDate() + mondayOffset + weekOffset * 7)

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    return date
  })

  // Count posts per day
  const postCountByDay = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const post of posts) {
      const postDate = new Date(post.scheduled_for)
      const key = `${postDate.getFullYear()}-${postDate.getMonth()}-${postDate.getDate()}`
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [posts])

  const weekLabel = useMemo(() => {
    const start = days[0]
    const end = days[6]
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
    const year = end.getFullYear()

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`
  }, [days])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{weekLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            {weekOffset !== 0 && (
              <Button variant="ghost" size="sm" onClick={onToday} className="text-xs h-7 px-2">
                Today
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            const count = postCountByDay[key] || 0
            const isToday =
              date.getFullYear() === today.getFullYear() &&
              date.getMonth() === today.getMonth() &&
              date.getDate() === today.getDate()
            const isPast = date < today && !isToday
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })

            return (
              <div
                key={key}
                className={`flex flex-col items-center py-2 rounded-lg transition-colors ${
                  isToday
                    ? 'bg-primary/10 ring-1 ring-primary/30'
                    : isPast
                    ? 'opacity-50'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className="text-[10px] uppercase text-muted-foreground font-medium">
                  {dayName}
                </span>
                <span
                  className={`text-sm font-medium mt-0.5 ${
                    isToday ? 'text-primary' : ''
                  }`}
                >
                  {date.getDate()}
                </span>
                <div className="flex gap-0.5 mt-1.5 h-2">
                  {count > 0 &&
                    Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isToday ? 'bg-primary' : 'bg-muted-foreground/40'
                        }`}
                      />
                    ))}
                  {count > 4 && (
                    <span className="text-[9px] text-muted-foreground ml-0.5">+{count - 4}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// --- Scheduled Post Card ---

function ScheduledPostCard({
  post,
  onCancel,
  cancelling,
}: {
  post: ScheduledPost
  onCancel: (id: string) => void
  cancelling: boolean
}) {
  const caption = getCaption(post)
  const mediaUrl = getMediaThumbnail(post)
  const scheduledDate = new Date(post.scheduled_for)
  const timeUntil = getTimeUntil(post.scheduled_for)

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          {mediaUrl ? (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
              <img
                src={mediaUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Platform Icons */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                {post.platforms.map((platform) => {
                  const Icon = PLATFORM_ICONS[platform]
                  const color = PLATFORM_COLORS[platform] || 'text-muted-foreground'
                  return Icon ? (
                    <Icon key={platform} className={`h-4 w-4 ${color}`} />
                  ) : (
                    <Badge key={platform} variant="outline" className="text-[10px] h-5">
                      {platform}
                    </Badge>
                  )
                })}
              </div>
              <Badge variant="secondary" className="text-[10px] h-5">
                {post.platforms.length} {post.platforms.length === 1 ? 'platform' : 'platforms'}
              </Badge>
            </div>

            {/* Caption Preview */}
            <p className="text-sm text-foreground line-clamp-2 mb-2">
              {caption
                ? caption.length > 100
                  ? caption.slice(0, 100) + '...'
                  : caption
                : 'No caption'}
            </p>

            {/* Schedule Time */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {scheduledDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                at{' '}
                {scheduledDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-muted-foreground/60">({timeUntil})</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-start">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onCancel(post.id)}
              disabled={cancelling}
            >
              {cancelling ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Published Post Card ---

function PublishedPostCard({ post }: { post: ScheduledPost }) {
  const caption = getCaption(post)
  const mediaUrl = getMediaThumbnail(post)
  const postedDate = post.posted_at ? new Date(post.posted_at) : null
  const hasErrors = Object.keys(post.platform_errors || {}).length > 0
  const isPartial = post.status === 'partial'
  const isFailed = post.status === 'failed'

  return (
    <Card className={`overflow-hidden ${hasErrors ? 'border-destructive/30' : ''}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          {mediaUrl ? (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
              <img
                src={mediaUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Platform Icons with check marks */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                {post.platforms.map((platform) => {
                  const Icon = PLATFORM_ICONS[platform]
                  const hasError = post.platform_errors?.[platform]
                  const color = hasError
                    ? 'text-destructive'
                    : PLATFORM_COLORS[platform] || 'text-muted-foreground'

                  return (
                    <div key={platform} className="relative">
                      {Icon ? (
                        <Icon className={`h-4 w-4 ${color}`} />
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {platform}
                        </Badge>
                      )}
                      {!hasError && (
                        <Check className="h-2.5 w-2.5 text-green-500 absolute -top-1 -right-1" />
                      )}
                      {hasError && (
                        <X className="h-2.5 w-2.5 text-destructive absolute -top-1 -right-1" />
                      )}
                    </div>
                  )
                })}
              </div>
              {(isPartial || isFailed) && (
                <Badge variant="destructive" className="text-[10px] h-5">
                  {isFailed ? 'Failed' : 'Partial'}
                </Badge>
              )}
            </div>

            {/* Caption Preview */}
            <p className="text-sm text-foreground line-clamp-2 mb-2">
              {caption
                ? caption.length > 100
                  ? caption.slice(0, 100) + '...'
                  : caption
                : 'No caption'}
            </p>

            {/* Posted Time and Platform Post IDs */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {postedDate && (
                <div className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>
                    Posted{' '}
                    {postedDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {postedDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              {Object.entries(post.platform_post_ids || {}).map(([platform, postId]) => (
                <div key={platform} className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  <span className="capitalize">{platform}:</span>
                  <span className="font-mono text-[10px]">
                    {String(postId).slice(0, 12)}
                    {String(postId).length > 12 ? '...' : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Errors */}
            {hasErrors && (
              <div className="mt-2 space-y-1">
                {Object.entries(post.platform_errors).map(([platform, errorMsg]) => (
                  <div
                    key={platform}
                    className="flex items-start gap-1.5 text-xs text-destructive"
                  >
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="font-medium capitalize">{platform}:</span>{' '}
                      {String(errorMsg)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Engagement Metrics (from content_items if available) */}
            {post.content_items && (
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {post.content_items.hashtags && post.content_items.hashtags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{post.content_items.hashtags.length} hashtags</span>
                  </div>
                )}
                {post.content_items.content_type && (
                  <Badge variant="outline" className="text-[10px] h-5 capitalize">
                    {post.content_items.content_type}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Skeleton ---

function PostsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex gap-4 animate-pulse">
              <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="h-4 w-4 rounded bg-muted" />
                  <div className="h-4 w-4 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// --- Utilities ---

function getCaption(post: ScheduledPost): string {
  if (post.custom_content?.caption) return post.custom_content.caption
  if (post.content_items?.body) return post.content_items.body
  if (post.content_items?.title) return post.content_items.title
  return ''
}

function getMediaThumbnail(post: ScheduledPost): string | null {
  if (post.content_items?.thumbnail_url) return post.content_items.thumbnail_url
  if (post.custom_content?.media_urls && post.custom_content.media_urls.length > 0) {
    return post.custom_content.media_urls[0]
  }
  if (post.content_items?.media_urls && post.content_items.media_urls.length > 0) {
    return post.content_items.media_urls[0]
  }
  return null
}

function getTimeUntil(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()

  if (diffMs < 0) return 'overdue'

  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `in ${diffMins}m`
  if (diffHours < 24) return `in ${diffHours}h`
  if (diffDays === 1) return 'tomorrow'
  return `in ${diffDays}d`
}
