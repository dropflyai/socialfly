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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send initial greeting on mount
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: "Hey! I'm your AI content creator. I can help you make videos, images, or turn your existing media into something new.\n\nWhat would you like to create today?",
    }])
    // Load media library
    fetch('/api/media?type=all')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.assets) setAvailableMedia(data.assets.slice(0, 20))
      })
      .catch(() => {})
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
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              generatedMedia: { type: 'video', url: data.videoUrl, model: data.model },
            }
            return updated
          })
        } else {
          const err = await res.json()
          setMessages(prev => [...prev, { role: 'assistant', content: `Generation failed: ${err.error}` }])
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
        } else {
          const err = await res.json()
          setMessages(prev => [...prev, { role: 'assistant', content: `Generation failed: ${err.error}` }])
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Generation failed. Try again.' }])
    }
    setGenerating(false)
    setGeneratingType(null)
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
                  <div className="p-3 flex gap-2 border-t border-primary/10">
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
                      {/* Remix */}
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => sendMessage("Make a different variation of this — same concept, fresh take")}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Post / Schedule */}
                    <Button size="sm" className="w-full h-8 gap-1 text-xs" onClick={async () => {
                      try {
                        const res = await fetch('/api/posts/publish', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            text: messages.filter(m => m.action?.description).pop()?.action?.description || 'AI generated content',
                            platforms: ['instagram'],
                            mediaUrls: [msg.generatedMedia!.url],
                            mediaType: msg.generatedMedia!.type === 'video' ? 'video' : 'image',
                            scheduleFor: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                          }),
                        })
                        if (res.ok) {
                          setMessages(prev => [...prev, { role: 'assistant', content: 'Scheduled to post in 5 minutes! Check your Schedule page to see it.' }])
                        } else {
                          const err = await res.json()
                          setMessages(prev => [...prev, { role: 'assistant', content: `Couldn't schedule: ${err.error}. Try saving to your library and posting from the Schedule page.` }])
                        }
                      } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong scheduling. Try saving to library first.' }]) }
                    }}>
                      <Send className="h-3 w-3" />Schedule Post (5 min)
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

        {/* Generation progress */}
        {generating && (
          <div className="flex justify-start">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary">Creating your {generatingType === 'generate_video' ? 'video' : 'image'}... {generatingType === 'generate_video' ? 'this may take 2-5 minutes for high quality' : 'this may take 15-30 seconds'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions (show when no messages yet) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
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
    </div>
  )
}
