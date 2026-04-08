'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send, Loader2, Video, ImageIcon, Sparkles, Upload, X, Play,
  RefreshCw, Download, Calendar, Check, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: {
    action: string
    prompt?: string
    negativePrompt?: string
    model?: string
    imageUrl?: string | null
    aspectRatio?: string
    duration?: string
    mediaId?: string
    suggestion?: string
    description?: string
    cacheKey?: string
    brief?: {
      subject?: string
      mood?: string
      style?: string
      cameraAngle?: string
      cameraMovement?: string
      cameraSpeed?: string
      lighting?: string
      colorPalette?: string
      platform?: string
      purpose?: string
      avoid?: string[]
      styleReference?: string
      [key: string]: unknown
    }
  } | null
  generatedMedia?: {
    type: 'video' | 'image'
    url: string
    model?: string
  }
}

interface MediaAsset {
  id: string
  name: string
  url: string
  type: string
}

export default function CreatorPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingType, setGeneratingType] = useState<string | null>(null)
  const [availableMedia, setAvailableMedia] = useState<MediaAsset[]>([])
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string | undefined>(undefined)
  const [showBrandPicker, setShowBrandPicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Recent creations
  const [recentCreations, setRecentCreations] = useState<{ url: string; type: string; name: string; createdAt: string }[]>([])

  // Auto-save generated content to media library
  async function autoSaveToLibrary(mediaUrl: string, mediaType: 'image' | 'video') {
    try {
      const res = await fetch(mediaUrl)
      const blob = await res.blob()
      const formData = new FormData()
      formData.append('file', blob, `ai-${mediaType}-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'png'}`)
      formData.append('name', `AI ${mediaType} - ${new Date().toLocaleString()}`)
      formData.append('category', 'ai-generated')
      await fetch('/api/media', { method: 'POST', body: formData })
      setRecentCreations(prev => [{ url: mediaUrl, type: mediaType, name: `AI ${mediaType}`, createdAt: new Date().toISOString() }, ...prev.slice(0, 9)])
    } catch { /* silent — don't block the user */ }
  }

  // Background video generation
  const [bgGenerating, setBgGenerating] = useState(false)
  const [bgProgress, setBgProgress] = useState<{ model: string; startedAt: number; estimatedSeconds: number; queuePosition?: number } | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Post flow state
  const [showPostFlow, setShowPostFlow] = useState(false)
  const [postMediaUrl, setPostMediaUrl] = useState<string | null>(null)
  const [postMediaType, setPostMediaType] = useState<'image' | 'video'>('image')
  const [postCaption, setPostCaption] = useState('')
  const [postPlatforms, setPostPlatforms] = useState<string[]>(['instagram'])
  const [postTiming, setPostTiming] = useState<'now' | 'schedule'>('now')
  const [postScheduleDate, setPostScheduleDate] = useState('')
  const [postScheduleTime, setPostScheduleTime] = useState('')
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send initial greeting and load data on mount
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: "Hey! I'm your AI content creator. I can help you make videos, images, or turn your existing media into something new.\n\nWhat would you like to create today?",
    }])
    // Load media library
    fetch('/api/media?type=all')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.assets) {
          setAvailableMedia(data.assets.slice(0, 20))
          // Show recent AI-generated content
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aiGenerated = data.assets.filter((a: any) => a.name?.startsWith('AI ')).slice(0, 6)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setRecentCreations(aiGenerated.map((a: any) => ({ url: a.url, type: a.type, name: a.name, createdAt: a.created_at })))
        }
      })
      .catch(() => {})
    // Cleanup poll on unmount
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function sendMessage(text?: string) {
    const messageText = text || input.trim()
    if (!messageText || sending) return

    const userMessage: ChatMessage = { role: 'user', content: messageText }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/creator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          mediaContext: selectedMedia ? { type: selectedMedia.type, url: selectedMedia.url, name: selectedMedia.name } : undefined,
          brandId: selectedBrandId,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message,
          action: data.action,
        }
        setMessages(prev => [...prev, assistantMessage])

        if (data.availableMedia?.length && availableMedia.length === 0) {
          setAvailableMedia(data.availableMedia)
        }
        if (data.brands?.length && brands.length === 0) {
          setBrands(data.brands)
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }])
    }
    setSending(false)
  }

  async function handleGenerate(action: ChatMessage['action']) {
    if (!action) return
    setGenerating(true)
    setGeneratingType(action.action)

    try {
      if (action.action === 'generate_video') {
        const res = await fetch('/api/video/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: action.prompt,
            negativePrompt: action.negativePrompt,
            model: action.model || 'auto',
            imageUrl: action.imageUrl || selectedMedia?.url,
            duration: action.duration,
            aspectRatio: action.aspectRatio,
          }),
        })

        if (res.ok) {
          const data = await res.json()

          if (data.async && data.statusUrl) {
            // Async — run in background, keep chat usable
            setGenerating(false)
            setGeneratingType(null)
            setBgGenerating(true)
            setBgProgress({ model: data.model, startedAt: Date.now(), estimatedSeconds: 180, queuePosition: undefined })

            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Your video is generating with ${data.model}. This takes 2-5 minutes — you can keep chatting while it works! I'll show it here when it's ready.`,
            }])

            // Poll every 8 seconds
            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = setInterval(async () => {
              try {
                const statusRes = await fetch(data.statusUrl, { credentials: 'include' })
                if (!statusRes.ok) return
                const status = await statusRes.json()

                if (status.status === 'completed' && status.videoUrl) {
                  if (pollRef.current) clearInterval(pollRef.current)
                  setBgGenerating(false)
                  setBgProgress(null)
                  setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Your video is ready!',
                    generatedMedia: { type: 'video', url: status.videoUrl, model: data.model },
                  }])
                  autoSaveToLibrary(status.videoUrl, 'video')
                  // Browser notification if tab not focused
                  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('SocialFly', { body: 'Your video is ready!' })
                  }
                } else if (status.status === 'failed') {
                  if (pollRef.current) clearInterval(pollRef.current)
                  setBgGenerating(false)
                  setBgProgress(null)
                  setMessages(prev => [...prev, { role: 'assistant', content: 'Video generation failed. Try a different style or model.' }])
                } else if (status.status === 'processing') {
                  setBgProgress(prev => prev ? {
                    ...prev,
                    estimatedSeconds: status.estimatedSeconds || Math.max(0, prev.estimatedSeconds - 8),
                    queuePosition: status.queuePosition,
                  } : prev)
                }
              } catch { /* ignore poll errors */ }
            }, 8000)

            // Safety timeout — stop polling after 8 minutes
            setTimeout(() => {
              if (pollRef.current) clearInterval(pollRef.current)
              setBgGenerating(false)
              setBgProgress(null)
            }, 480000)

            // Request notification permission
            if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission()
            }

            return
          } else {
            // Sync result
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                generatedMedia: { type: 'video', url: data.videoUrl, model: data.model },
              }
              return updated
            })
            autoSaveToLibrary(data.videoUrl, 'video')
            setGenerating(false)
            setGeneratingType(null)
          }
        } else {
          const err = await res.json()
          setMessages(prev => [...prev, { role: 'assistant', content: `Generation failed: ${err.error}` }])
          setGenerating(false)
          setGeneratingType(null)
        }
      } else if (action.action === 'generate_image') {
        const res = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: action.prompt,
            aspectRatio: action.aspectRatio || '1:1',
          }),
        })

        if (res.ok) {
          const data = await res.json()
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              generatedMedia: { type: 'image', url: data.imageUrl },
            }
            return updated
          })
          autoSaveToLibrary(data.imageUrl, 'image')
        } else {
          const err = await res.json()
          setMessages(prev => [...prev, { role: 'assistant', content: `Generation failed: ${err.error}` }])
        }
        setGenerating(false)
        setGeneratingType(null)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Generation failed. Try again.' }])
      setGenerating(false)
      setGeneratingType(null)
    }
    // Note: for async video, generating state is cleared by the poll handler, not here
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', file.name.replace(/\.[^.]+$/, ''))
    formData.append('category', 'general')

    try {
      const res = await fetch('/api/media', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        const asset = { id: data.asset.id, name: data.asset.name, url: data.asset.url, type: data.asset.type }
        setSelectedMedia(asset)
        setAvailableMedia(prev => [asset, ...prev])
        sendMessage(`I uploaded "${asset.name}" — help me create something with it`)
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">AI Creator</h1>
          {selectedMedia && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Using: {selectedMedia.name}
              <button onClick={() => setSelectedMedia(null)}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {brands.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowBrandPicker(!showBrandPicker)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-muted hover:bg-muted/80 transition-all"
              >
                <span className="text-muted-foreground">Brand:</span>
                <span className="font-medium">{selectedBrandId ? brands.find(b => b.id === selectedBrandId)?.name || 'Auto' : 'Auto'}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              {showBrandPicker && (
                <div className="absolute top-full left-0 mt-1 bg-background border rounded-lg shadow-lg z-50 min-w-[160px]">
                  <button
                    onClick={() => { setSelectedBrandId(undefined); setShowBrandPicker(false) }}
                    className={`w-full px-3 py-2 text-xs text-left hover:bg-muted transition-all ${!selectedBrandId ? 'text-primary font-medium' : ''}`}
                  >
                    Auto-detect from conversation
                  </button>
                  {brands.map(b => (
                    <button
                      key={b.id}
                      onClick={() => { setSelectedBrandId(b.id); setShowBrandPicker(false) }}
                      className={`w-full px-3 py-2 text-xs text-left hover:bg-muted transition-all ${selectedBrandId === b.id ? 'text-primary font-medium' : ''}`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowMediaPicker(!showMediaPicker)} className="gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            My Media
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => handleUpload(e.target.files)} />
        </div>
      </div>

      {/* Media action panel — shows when media is selected */}
      {selectedMedia && !showMediaPicker && (
        <div className="border-b p-3 bg-primary/5">
          <div className="flex items-center gap-3 mb-2">
            {selectedMedia.type === 'video' ? (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Video className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedMedia.url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedMedia.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{selectedMedia.type}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedMedia.type === 'image' && (
              <>
                <button onClick={() => sendMessage(`Animate this image into a cinematic video for Instagram`)} className="px-2.5 py-1 rounded-full border text-xs hover:bg-primary/10 hover:border-primary/30 transition-all">
                  <Play className="h-3 w-3 inline mr-1" />Animate to Video
                </button>
                <button onClick={() => sendMessage(`Edit this image — suggest some creative edits`)} className="px-2.5 py-1 rounded-full border text-xs hover:bg-primary/10 hover:border-primary/30 transition-all">
                  <Sparkles className="h-3 w-3 inline mr-1" />AI Edit
                </button>
                <button onClick={() => sendMessage(`Create variations of this image in different styles`)} className="px-2.5 py-1 rounded-full border text-xs hover:bg-primary/10 hover:border-primary/30 transition-all">
                  <RefreshCw className="h-3 w-3 inline mr-1" />Variations
                </button>
                <button onClick={() => sendMessage(`Write captions for this image for Instagram, Facebook, and LinkedIn`)} className="px-2.5 py-1 rounded-full border text-xs hover:bg-primary/10 hover:border-primary/30 transition-all">
                  <Send className="h-3 w-3 inline mr-1" />Write Captions
                </button>
              </>
            )}
            {selectedMedia.type === 'video' && (
              <>
                <button onClick={() => sendMessage(`Create a shorter version of this video for Instagram Reels`)} className="px-2.5 py-1 rounded-full border text-xs hover:bg-primary/10 hover:border-primary/30 transition-all">
                  <Video className="h-3 w-3 inline mr-1" />Reels Version
                </button>
                <button onClick={() => sendMessage(`Write captions for this video for Instagram, TikTok, and LinkedIn`)} className="px-2.5 py-1 rounded-full border text-xs hover:bg-primary/10 hover:border-primary/30 transition-all">
                  <Send className="h-3 w-3 inline mr-1" />Write Captions
                </button>
              </>
            )}
            <button onClick={() => sendMessage(`What else can I create with this ${selectedMedia.type}?`)} className="px-2.5 py-1 rounded-full border text-xs hover:bg-primary/10 hover:border-primary/30 transition-all">
              More Ideas
            </button>
          </div>
        </div>
      )}

      {/* Media picker dropdown */}
      {showMediaPicker && availableMedia.length > 0 && (
        <div className="border-b p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">Select media to work with:</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableMedia.map(asset => (
              <button
                key={asset.id}
                onClick={() => {
                  setSelectedMedia(asset)
                  setShowMediaPicker(false)
                  sendMessage(`I want to use my ${asset.type} "${asset.name}" — what can we create with it?`)
                }}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  selectedMedia?.id === asset.id ? 'border-primary' : 'border-transparent hover:border-primary/30'
                }`}
              >
                {asset.type === 'video' ? (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Video className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {/* Background video progress bar */}
      {bgGenerating && bgProgress && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium">Generating video</span>
              <Badge variant="secondary" className="text-[10px]">{bgProgress.model}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {bgProgress.queuePosition && bgProgress.queuePosition > 0
                ? `Queue #${bgProgress.queuePosition}`
                : `~${Math.max(0, Math.ceil(bgProgress.estimatedSeconds / 60))} min left`
              }
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{
                width: `${Math.min(95, Math.max(5, ((Date.now() - bgProgress.startedAt) / (bgProgress.estimatedSeconds * 1000)) * 100))}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">You can keep chatting — the video will appear when ready</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
              <div className={`rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>

              {/* Creative brief + generate button */}
              {msg.action && !msg.generatedMedia && (
                <div className="mt-2 rounded-xl border bg-primary/5 overflow-hidden">
                  {/* Brief header */}
                  <div className="p-3 flex items-center justify-between border-b border-primary/10">
                    <div className="flex items-center gap-2">
                      {msg.action.action === 'generate_video' ? (
                        <Video className="h-4 w-4 text-primary" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-primary" />
                      )}
                      <span className="text-xs font-medium">
                        {msg.action.description || `Ready to create ${msg.action.action === 'generate_video' ? 'video' : 'image'}`}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] capitalize">{msg.action.model || 'auto'}</Badge>
                  </div>

                  {/* Visual brief details */}
                  {msg.action.brief && (
                    <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      {msg.action.brief.mood && (
                        <div><span className="text-muted-foreground">Mood:</span> <span className="font-medium">{msg.action.brief.mood}</span></div>
                      )}
                      {msg.action.brief.cameraAngle && (
                        <div><span className="text-muted-foreground">Camera:</span> <span className="font-medium">{msg.action.brief.cameraAngle}</span></div>
                      )}
                      {msg.action.brief.cameraMovement && (
                        <div><span className="text-muted-foreground">Movement:</span> <span className="font-medium">{msg.action.brief.cameraMovement}</span></div>
                      )}
                      {msg.action.brief.lighting && (
                        <div><span className="text-muted-foreground">Lighting:</span> <span className="font-medium">{msg.action.brief.lighting}</span></div>
                      )}
                      {msg.action.brief.platform && (
                        <div><span className="text-muted-foreground">Platform:</span> <span className="font-medium capitalize">{msg.action.brief.platform}</span></div>
                      )}
                      {msg.action.aspectRatio && (
                        <div><span className="text-muted-foreground">Format:</span> <span className="font-medium">{msg.action.aspectRatio}</span></div>
                      )}
                      {msg.action.duration && msg.action.action === 'generate_video' && (
                        <div><span className="text-muted-foreground">Duration:</span> <span className="font-medium">{msg.action.duration}s</span></div>
                      )}
                      {msg.action.brief.style && (
                        <div><span className="text-muted-foreground">Style:</span> <span className="font-medium">{msg.action.brief.style}</span></div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-3 space-y-2 border-t border-primary/10">
                    {/* Credit cost */}
                    <div className="text-[10px] text-muted-foreground text-center">
                      {msg.action.action === 'generate_video'
                        ? `This will use ${msg.action.model === 'seedance' ? 50 : msg.action.model === 'ltx' || msg.action.model === 'fast' ? 25 : 50} credits`
                        : 'This will use 5 credits'
                      }
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleGenerate(msg.action)}
                        disabled={generating}
                        className="flex-1 gap-1"
                      >
                        {generating && generatingType === msg.action.action ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />Creating...</>
                        ) : (
                          <><Sparkles className="h-3 w-3" />Create {msg.action.action === 'generate_video' ? 'Video' : 'Image'}</>
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => sendMessage('I want to change something —')}>
                        Adjust
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Generated media preview */}
              {msg.generatedMedia && (
                <div className="mt-2 rounded-xl overflow-hidden border">
                  {msg.generatedMedia.type === 'video' ? (
                    <video src={msg.generatedMedia.url} controls className="w-full max-h-80" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.generatedMedia.url} alt="" className="w-full max-h-80 object-contain" />
                  )}
                  <div className="p-2 space-y-2 bg-muted/50">
                    <div className="flex items-center gap-2">
                      {msg.generatedMedia.model && (
                        <Badge variant="secondary" className="text-[10px]">{msg.generatedMedia.model}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{msg.generatedMedia.type}</Badge>
                    </div>
                    <div className="flex gap-1">
                      {/* Save to library */}
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs flex-1" onClick={async () => {
                        try {
                          const res = await fetch(msg.generatedMedia!.url)
                          const blob = await res.blob()
                          const formData = new FormData()
                          formData.append('file', blob, `ai-${msg.generatedMedia!.type}.${msg.generatedMedia!.type === 'video' ? 'mp4' : 'png'}`)
                          formData.append('name', `AI ${msg.generatedMedia!.type} - ${new Date().toLocaleDateString()}`)
                          formData.append('category', 'general')
                          const saveRes = await fetch('/api/media', { method: 'POST', body: formData })
                          if (saveRes.ok) {
                            setMessages(prev => [...prev, { role: 'assistant', content: 'Saved to your media library!' }])
                          }
                        } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to save — try downloading instead.' }]) }
                      }}>
                        <Download className="h-3 w-3" />Save to Library
                      </Button>
                      {/* Download */}
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                        <a href={msg.generatedMedia.url} download={`socialfly-${msg.generatedMedia.type}.${msg.generatedMedia.type === 'video' ? 'mp4' : 'png'}`} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3" />
                        </a>
                      </Button>
                      {/* Try Again — regenerate same prompt */}
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => {
                        const lastAction = messages.filter(m => m.action?.prompt).pop()?.action
                        if (lastAction) handleGenerate(lastAction)
                      }}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Post This */}
                    <Button size="sm" className="w-full h-8 gap-1 text-xs" onClick={() => {
                      setPostMediaUrl(msg.generatedMedia!.url)
                      setPostMediaType(msg.generatedMedia!.type)
                      setPostCaption('')
                      setShowPostFlow(true)
                    }}>
                      <Send className="h-3 w-3" />Post This
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Generation progress — for sync generation (images, fast video) */}
        {generating && (
          <div className="flex justify-start">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary">Creating your {generatingType === 'generate_video' ? 'video' : 'image'}... {generatingType === 'generate_image' ? '15-30 seconds' : 'a moment'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions + recent creations */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 space-y-3">
          {/* Recent creations */}
          {recentCreations.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Recent creations</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recentCreations.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedMedia({ id: `recent-${i}`, name: item.name, url: item.url, type: item.type })
                      sendMessage(`I want to work with this ${item.type} I created earlier`)
                    }}
                    className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary/30 transition-all relative"
                  >
                    {item.type === 'video' ? (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Play className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-[9px] text-white text-center py-0.5">
                      {item.type}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {[
              'Create a product showcase video',
              'Make an Instagram Reel for my brand',
              'Turn my latest image into a video',
              'Generate a professional brand image',
            ].map(suggestion => (
              <button
                key={suggestion}
                onClick={() => sendMessage(suggestion)}
                className="px-3 py-1.5 rounded-full border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Describe what you want to create..."
              className="w-full px-4 py-2.5 pr-12 rounded-xl border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm min-h-[44px] max-h-32"
              rows={1}
            />
          </div>
          <Button onClick={() => sendMessage()} disabled={!input.trim() || sending} size="icon" className="rounded-xl h-[44px] w-[44px]">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Post Flow Modal */}
      {showPostFlow && postMediaUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl border shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Post to Social Media</h3>
              <button onClick={() => setShowPostFlow(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Media preview */}
              <div className="rounded-lg overflow-hidden border max-h-48">
                {postMediaType === 'video' ? (
                  <video src={postMediaUrl} className="w-full max-h-48 object-contain" controls />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={postMediaUrl} alt="" className="w-full max-h-48 object-contain" />
                )}
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Caption</label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    disabled={generatingCaption}
                    onClick={async () => {
                      setGeneratingCaption(true)
                      try {
                        const brief = messages.find(m => m.action?.brief)?.action?.brief
                        const res = await fetch('/api/caption', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            context: brief?.subject || 'AI generated content for social media',
                            platforms: postPlatforms,
                            tone: brief?.mood || 'professional',
                            includeCta: true,
                          }),
                        })
                        if (res.ok) {
                          const data = await res.json()
                          const firstPlatform = postPlatforms[0] || 'instagram'
                          const caption = data.captions?.[firstPlatform]
                          if (caption) {
                            const hashtags = caption.hashtags?.join(' ') || ''
                            setPostCaption(`${caption.text}${hashtags ? '\n\n' + hashtags : ''}`)
                          }
                        }
                      } catch { /* ignore */ }
                      setGeneratingCaption(false)
                    }}
                  >
                    {generatingCaption ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    AI Write Caption
                  </Button>
                </div>
                <textarea
                  value={postCaption}
                  onChange={e => setPostCaption(e.target.value)}
                  placeholder="Write a caption or let AI generate one..."
                  className="w-full min-h-24 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>

              {/* Platforms */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Post to</label>
                <div className="flex flex-wrap gap-2">
                  {['instagram', 'facebook', 'linkedin', 'tiktok'].map(platform => (
                    <button
                      key={platform}
                      onClick={() => setPostPlatforms(prev =>
                        prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
                      )}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                        postPlatforms.includes(platform)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing */}
              <div className="space-y-2">
                <label className="text-sm font-medium">When</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPostTiming('now')}
                    className={`flex-1 p-2.5 rounded-lg border text-sm transition-all ${
                      postTiming === 'now' ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/30'
                    }`}
                  >
                    Post now
                  </button>
                  <button
                    onClick={() => setPostTiming('schedule')}
                    className={`flex-1 p-2.5 rounded-lg border text-sm transition-all ${
                      postTiming === 'schedule' ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/30'
                    }`}
                  >
                    Schedule for later
                  </button>
                </div>
                {postTiming === 'schedule' && (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={postScheduleDate}
                      onChange={e => setPostScheduleDate(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm"
                    />
                    <input
                      type="time"
                      value={postScheduleTime}
                      onChange={e => setPostScheduleTime(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex gap-2">
              <Button variant="outline" onClick={() => setShowPostFlow(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1"
                disabled={posting || !postPlatforms.length || !postCaption.trim()}
                onClick={async () => {
                  setPosting(true)
                  try {
                    let scheduleFor: string
                    if (postTiming === 'schedule' && postScheduleDate && postScheduleTime) {
                      scheduleFor = new Date(`${postScheduleDate}T${postScheduleTime}`).toISOString()
                    } else {
                      scheduleFor = new Date(Date.now() + 2 * 60 * 1000).toISOString()
                    }

                    const res = await fetch('/api/posts/publish', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        text: postCaption,
                        platforms: postPlatforms,
                        mediaUrls: [postMediaUrl],
                        mediaType: postMediaType,
                        scheduleFor,
                      }),
                    })

                    if (res.ok) {
                      setShowPostFlow(false)
                      const timeMsg = postTiming === 'now' ? 'in about 2 minutes' : `on ${postScheduleDate} at ${postScheduleTime}`
                      setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Scheduled to ${postPlatforms.join(', ')} ${timeMsg}! Check your Schedule page to track it.`,
                      }])
                    } else {
                      const err = await res.json()
                      setMessages(prev => [...prev, { role: 'assistant', content: `Couldn't schedule: ${err.error}` }])
                      setShowPostFlow(false)
                    }
                  } catch {
                    setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
                    setShowPostFlow(false)
                  }
                  setPosting(false)
                }}
              >
                {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {postTiming === 'now' ? 'Post Now' : 'Schedule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
