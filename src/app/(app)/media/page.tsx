'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Image,
  Video,
  Upload,
  Search,
  Trash2,
  X,
  FolderOpen,
  Filter,
  Grid3X3,
  List,
  Play,
  Clock,
  HardDrive,
  Tag,
  Wand2,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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

interface MediaAsset {
  id: string
  type: string
  category: string
  name: string
  description: string | null
  url: string
  thumbnail_url: string | null
  mime_type: string
  file_size: number | null
  tags: string[]
  usage_count: number
  last_used_at: string | null
  created_at: string
}

type MediaFilter = 'all' | 'image' | 'video'
type ViewMode = 'grid' | 'list'

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<MediaFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')
  const [editing, setEditing] = useState(false)
  const [editedUrl, setEditedUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleEditImage = async () => {
    if (!selectedAsset || !editPrompt.trim()) return
    setEditing(true)
    setEditedUrl(null)

    try {
      const res = await fetch('/api/image/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: selectedAsset.url,
          editPrompt: editPrompt.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Edit failed')

      setEditedUrl(data.imageUrl)
    } catch (err) {
      console.error('Image edit failed:', err)
    } finally {
      setEditing(false)
    }
  }

  const handleSaveEdited = async () => {
    if (!editedUrl || !selectedAsset) return

    // Upload the edited image as a new asset
    try {
      const res = await fetch(editedUrl)
      const blob = await res.blob()
      const formData = new FormData()
      formData.append('file', blob, `${selectedAsset.name}-edited.png`)
      formData.append('name', `${selectedAsset.name} (edited)`)
      formData.append('category', selectedAsset.category)

      const uploadRes = await fetch('/api/media', { method: 'POST', body: formData })
      if (uploadRes.ok) {
        setSelectedAsset(null)
        setEditPrompt('')
        setEditedUrl(null)
        await fetchAssets()
      }
    } catch (err) {
      console.error('Failed to save edited image:', err)
    }
  }

  const fetchAssets = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())

      const res = await fetch(`/api/media?${params}`)
      const data = await res.json()
      setAssets(data.assets || [])
    } catch (err) {
      console.error('Failed to fetch media:', err)
    } finally {
      setLoading(false)
    }
  }, [typeFilter, categoryFilter, searchQuery])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('name', file.name.replace(/\.[^.]+$/, ''))
        formData.append('category', 'general')

        const res = await fetch('/api/media', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json()
          console.error('Upload failed:', err.error)
        }
      }
      await fetchAssets()
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (assetId: string) => {
    setDeletingId(assetId)
    try {
      await fetch(`/api/media?id=${assetId}`, { method: 'DELETE' })
      setAssets((prev) => prev.filter((a) => a.id !== assetId))
      if (selectedAsset?.id === assetId) setSelectedAsset(null)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleUpload(e.dataTransfer.files)
  }

  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets
    const q = searchQuery.toLowerCase()
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q))
    )
  }, [assets, searchQuery])

  const imageCount = assets.filter((a) => a.type === 'image').length
  const videoCount = assets.filter((a) => a.type === 'video').length
  const totalSize = assets.reduce((sum, a) => sum + (a.file_size || 0), 0)

  return (
    <div
      className="space-y-6 animate-fade-in"
      onDragEnter={handleDrag}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media Library</h1>
          <p className="text-muted-foreground">
            Upload and manage images and videos for your content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <Image className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{imageCount}</p>
              <p className="text-xs text-muted-foreground">Images</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <Video className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{videoCount}</p>
              <p className="text-xs text-muted-foreground">Videos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{formatFileSize(totalSize)}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or tag..."
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
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as MediaFilter)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="brand">Brand</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="lifestyle">Lifestyle</SelectItem>
              <SelectItem value="testimonial">Testimonial</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Drop Zone Overlay */}
      {dragActive && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="border-2 border-dashed border-primary rounded-xl p-16 text-center">
            <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Drop files to upload</p>
            <p className="text-sm text-muted-foreground mt-1">Images and videos up to 100MB</p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <MediaSkeleton viewMode={viewMode} />
      ) : filteredAssets.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredAssets.map((asset) => (
              <MediaGridCard
                key={asset.id}
                asset={asset}
                onSelect={() => setSelectedAsset(asset)}
                onDelete={() => handleDelete(asset.id)}
                deleting={deletingId === asset.id}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssets.map((asset) => (
              <MediaListRow
                key={asset.id}
                asset={asset}
                onSelect={() => setSelectedAsset(asset)}
                onDelete={() => handleDelete(asset.id)}
                deleting={deletingId === asset.id}
              />
            ))}
          </div>
        )
      ) : assets.length === 0 ? (
        /* Empty State */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl mb-2">No media yet</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">
              Upload images and videos to use in your scheduled content.
              Drag and drop or click upload to get started.
            </CardDescription>
            <Button className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload Media
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* No results */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No media matches your filters.</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => { setSearchQuery(''); setTypeFilter('all'); setCategoryFilter('all') }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Asset Preview Dialog */}
      <Dialog open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        {selectedAsset && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedAsset.name}</DialogTitle>
              <DialogDescription>
                {selectedAsset.type === 'video' ? 'Video' : 'Image'} &middot;{' '}
                {formatFileSize(selectedAsset.file_size || 0)} &middot;{' '}
                Uploaded {formatDate(selectedAsset.created_at)}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg overflow-hidden bg-muted">
              {selectedAsset.type === 'video' ? (
                <video
                  src={selectedAsset.url}
                  controls
                  className="w-full max-h-[400px] object-contain"
                />
              ) : (
                <img
                  src={selectedAsset.url}
                  alt={selectedAsset.name}
                  className="w-full max-h-[400px] object-contain"
                />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="capitalize">{selectedAsset.category}</Badge>
                {selectedAsset.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    <Tag className="h-2.5 w-2.5 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {selectedAsset.usage_count > 0 && (
                  <span>Used {selectedAsset.usage_count}x</span>
                )}
              </div>
            </div>
            {/* Smart Image Edit */}
            {selectedAsset.type === 'image' && (
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Smart Edit</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Remove background, Add text '20% OFF', Make more vibrant..."
                    className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEditImage()}
                  />
                  <Button
                    size="sm"
                    onClick={handleEditImage}
                    disabled={!editPrompt.trim() || editing}
                    className="gap-1.5"
                  >
                    {editing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {editing ? 'Editing...' : 'Apply'}
                  </Button>
                </div>

                {/* Before/After comparison */}
                {editedUrl && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Before / After</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg overflow-hidden bg-muted border">
                        <img src={selectedAsset.url} alt="Original" className="w-full h-48 object-contain" />
                        <p className="text-[10px] text-center text-muted-foreground py-1">Original</p>
                      </div>
                      <div className="rounded-lg overflow-hidden bg-muted border border-primary/30">
                        <img src={editedUrl} alt="Edited" className="w-full h-48 object-contain" />
                        <p className="text-[10px] text-center text-primary py-1">Edited</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={handleSaveEdited} className="w-full gap-1.5">
                      Save as New Asset
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => { handleDelete(selectedAsset.id); setSelectedAsset(null) }}
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

function MediaGridCard({
  asset,
  onSelect,
  onDelete,
  deleting,
}: {
  asset: MediaAsset
  onSelect: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const isVideo = asset.type === 'video'

  return (
    <div
      className="group relative rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-all"
      onClick={onSelect}
    >
      <div className="aspect-square">
        {isVideo ? (
          <div className="relative w-full h-full">
            <video
              src={asset.url}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="rounded-full bg-black/60 p-2">
                <Play className="h-4 w-4 text-white fill-white" />
              </div>
            </div>
          </div>
        ) : (
          <img
            src={asset.url}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium truncate">{asset.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatFileSize(asset.file_size || 0)}
        </p>
      </div>
      {/* Delete button on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        disabled={deleting}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-destructive text-white rounded-md p-1.5"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function MediaListRow({
  asset,
  onSelect,
  onDelete,
  deleting,
}: {
  asset: MediaAsset
  onSelect: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const isVideo = asset.type === 'video'

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted relative">
        {isVideo ? (
          <>
            <video src={asset.url} className="w-full h-full object-cover" muted preload="metadata" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="h-3.5 w-3.5 text-white fill-white drop-shadow" />
            </div>
          </>
        ) : (
          <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{asset.name}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {isVideo ? <Video className="h-3 w-3" /> : <Image className="h-3 w-3" />}
            {isVideo ? 'Video' : 'Image'}
          </span>
          <span>{formatFileSize(asset.file_size || 0)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(asset.created_at)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {asset.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
        ))}
        <Badge variant="secondary" className="text-xs capitalize">{asset.category}</Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          disabled={deleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function MediaSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'grid') {
    return (
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 animate-pulse">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted rounded-lg" />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 bg-muted rounded-lg" />
      ))}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
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
