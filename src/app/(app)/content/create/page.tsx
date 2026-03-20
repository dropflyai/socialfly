'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Sparkles, Video, FileText, ImageIcon, ArrowLeft, Loader2, Send, Clock, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

interface PlatformVariant {
  text: string
  hashtags: string[]
  suggested_media: string
  best_posting_time: string
}

interface GeneratedContent {
  id?: string
  variants: Record<string, PlatformVariant>
  contentPillar: string
  engagementHooks: string[]
  tokensUsed: number
}

const platformIcons: Record<string, string> = {
  twitter: '\ud835\udd4f',
  instagram: '\ud83d\udcf8',
  tiktok: '\ud83c\udfb5',
}

function CreateContentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultTab = searchParams.get('type') || 'photo'

  const [prompt, setPrompt] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')
  const [generatedImageUrl, setGeneratedImageUrl] = useState('')
  const [manualImageUrl, setManualImageUrl] = useState('')
  const [generatingImage, setGeneratingImage] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram'])
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(defaultTab)

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  const handleGenerateImage = async () => {
    if (!imagePrompt) return
    setGeneratingImage(true)
    setError(null)

    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, aspectRatio }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Image generation failed')

      setGeneratedImageUrl(data.imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    } finally {
      setGeneratingImage(false)
    }
  }

  const currentImageUrl = generatedImageUrl || manualImageUrl

  const handleGenerate = async () => {
    if (!prompt || !selectedPlatforms.length) return
    setGenerating(true)
    setError(null)
    setGeneratedContent(null)

    try {
      const contentType = activeTab === 'video' ? 'video_script'
        : activeTab === 'photo' ? 'image_caption'
        : 'text'

      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          platforms: selectedPlatforms,
          contentType,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setGeneratedContent(data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handlePublishNow = async () => {
    if (!generatedContent) return
    setPublishing(true)
    setError(null)

    try {
      const firstVariant = Object.values(generatedContent.variants)[0]
      const res = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: generatedContent.id,
          text: firstVariant.text,
          platforms: selectedPlatforms,
          mediaUrls: currentImageUrl ? [currentImageUrl] : undefined,
          mediaType: currentImageUrl ? 'image' : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publish failed')

      setSuccessMessage('Published successfully!')
      setTimeout(() => router.push('/content'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  const handleSchedule = async () => {
    if (!generatedContent || !scheduleDate || !scheduleTime) return
    setScheduling(true)
    setError(null)

    try {
      const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
      const firstVariant = Object.values(generatedContent.variants)[0]

      const res = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: generatedContent.id,
          text: firstVariant.text,
          platforms: selectedPlatforms,
          scheduleFor: scheduledFor,
          mediaUrls: currentImageUrl ? [currentImageUrl] : undefined,
          mediaType: currentImageUrl ? 'image' : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scheduling failed')

      setSuccessMessage('Post scheduled!')
      setTimeout(() => router.push('/schedule'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scheduling failed')
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/content">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Content</h1>
          <p className="text-muted-foreground">Generate content with AI and publish across platforms</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Platforms</CardTitle>
          <CardDescription>Select which platforms to generate content for</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {['twitter', 'instagram', 'tiktok'].map((platform) => (
              <Button
                key={platform}
                variant={selectedPlatforms.includes(platform) ? 'default' : 'outline'}
                size="sm"
                onClick={() => togglePlatform(platform)}
                className="gap-2"
              >
                <span>{platformIcons[platform]}</span>
                {platform === 'twitter' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab} className="space-y-6" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="photo" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Photo Post
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            Text Content
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2">
            <Video className="h-4 w-4" />
            Video Script
          </TabsTrigger>
        </TabsList>

        {/* Photo Post Tab */}
        <TabsContent value="photo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Photo Post</CardTitle>
              <CardDescription>
                Generate an image with AI or provide a URL, then generate a caption
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Source */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-prompt">Generate image with AI</Label>
                  <textarea
                    id="image-prompt"
                    placeholder="e.g., A modern tech startup office with holographic displays showing AI voice assistants, futuristic blue lighting, professional photography style..."
                    className="w-full min-h-24 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      {['1:1', '4:5', '9:16'].map((ratio) => (
                        <Button
                          key={ratio}
                          variant={aspectRatio === ratio ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setAspectRatio(ratio)}
                        >
                          {ratio}
                        </Button>
                      ))}
                    </div>
                    <Button
                      onClick={handleGenerateImage}
                      disabled={!imagePrompt || generatingImage}
                      className="gap-2"
                    >
                      {generatingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Image...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Image
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-border" />
                  <span className="mx-4 text-sm text-muted-foreground">or</span>
                  <div className="flex-grow border-t border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-url">Paste an image URL</Label>
                  <Input
                    id="manual-url"
                    placeholder="https://example.com/your-image.jpg"
                    value={manualImageUrl}
                    onChange={(e) => {
                      setManualImageUrl(e.target.value)
                      if (e.target.value) setGeneratedImageUrl('')
                    }}
                  />
                </div>
              </div>

              {/* Image Preview */}
              {currentImageUrl && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="relative rounded-lg overflow-hidden border bg-muted max-w-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentImageUrl}
                      alt="Generated preview"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}

              {/* Caption Generation */}
              <div className="space-y-2">
                <Label htmlFor="caption-prompt">What should the caption be about?</Label>
                <textarea
                  id="caption-prompt"
                  placeholder="e.g., Introduce DropFly's AI voice agents for small businesses, emphasize 24/7 availability and how it saves time..."
                  className="w-full min-h-24 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!prompt || !selectedPlatforms.length || generating || !currentImageUrl}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Caption...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Caption
                  </>
                )}
              </Button>
              {!currentImageUrl && prompt && (
                <p className="text-xs text-muted-foreground">Generate or paste an image first</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Text Content Tab */}
        <TabsContent value="text" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Content Writer</CardTitle>
              <CardDescription>
                Describe what you want to post and AI generates platform-optimized versions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">What would you like to post about?</Label>
                <textarea
                  id="prompt"
                  placeholder="e.g., Announce our new AI-powered voice agents that handle customer calls 24/7..."
                  className="w-full min-h-32 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={!prompt || !selectedPlatforms.length || generating} className="gap-2">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video Script Tab */}
        <TabsContent value="video" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Video Script Writer</CardTitle>
              <CardDescription>
                Generate video scripts with hooks, body, and call-to-action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-prompt">Describe your video concept</Label>
                <textarea
                  id="video-prompt"
                  placeholder="e.g., A 30-second reel explaining how DropFly's AI handles phone calls for small businesses..."
                  className="w-full min-h-32 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={!prompt || !selectedPlatforms.length || generating} className="gap-2">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Script
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generated Content Preview */}
      {generatedContent && (
        <>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Generated Content</h2>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{generatedContent.contentPillar}</Badge>
              <Badge variant="outline">{generatedContent.tokensUsed} tokens used</Badge>
              {currentImageUrl && <Badge variant="secondary">With image</Badge>}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(generatedContent.variants).map(([platform, variant]) => (
                <Card key={platform}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{platformIcons[platform]}</span>
                      <CardTitle className="text-base capitalize">
                        {platform === 'twitter' ? 'X (Twitter)' : platform}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {currentImageUrl && (
                      <div className="rounded overflow-hidden border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={currentImageUrl} alt="Post image" className="w-full h-32 object-cover" />
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{variant.text}</p>
                    {variant.hashtags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {variant.hashtags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Best time: {variant.best_posting_time}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {generatedContent.engagementHooks?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Engagement Ideas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {generatedContent.engagementHooks.map((hook, i) => (
                      <li key={i}>- {hook}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Publish / Schedule */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={handlePublishNow}
                  disabled={publishing || scheduling}
                  className="gap-2"
                >
                  {publishing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Publish Now
                </Button>

                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-40"
                  />
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-32"
                  />
                  <Button
                    variant="outline"
                    onClick={handleSchedule}
                    disabled={!scheduleDate || !scheduleTime || scheduling || publishing}
                    className="gap-2"
                  >
                    {scheduling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    Schedule
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function CreateContentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-muted rounded" />
        <div className="space-y-2">
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="h-4 w-60 bg-muted rounded" />
        </div>
      </div>
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  )
}

export default function CreateContentPage() {
  return (
    <Suspense fallback={<CreateContentLoading />}>
      <CreateContentContent />
    </Suspense>
  )
}
