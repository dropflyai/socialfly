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

  // Video state
  const [videoPrompt, setVideoPrompt] = useState('')
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState('')
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoModel, setVideoModel] = useState<'fast' | 'quality'>('fast')
  const [useImageForVideo, setUseImageForVideo] = useState(false)
  const [videoImagePrompt, setVideoImagePrompt] = useState('')
  const [videoImageUrl, setVideoImageUrl] = useState('')
  const [generatingVideoImage, setGeneratingVideoImage] = useState(false)

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

  const handleGenerateVideoImage = async () => {
    if (!videoImagePrompt) return
    setGeneratingVideoImage(true)
    setError(null)

    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: videoImagePrompt, aspectRatio: '9:16' }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Image generation failed')

      setVideoImageUrl(data.imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    } finally {
      setGeneratingVideoImage(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!videoPrompt) return
    setGeneratingVideo(true)
    setError(null)
    setGeneratedVideoUrl('')

    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          model: videoModel,
          imageUrl: useImageForVideo && videoImageUrl ? videoImageUrl : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Video generation failed')

      setGeneratedVideoUrl(data.videoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video generation failed')
    } finally {
      setGeneratingVideo(false)
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
      const mediaUrl = activeTab === 'video' ? generatedVideoUrl : currentImageUrl
      const mediaType = activeTab === 'video' ? 'video' : mediaUrl ? 'image' : undefined
      const res = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: generatedContent.id,
          text: firstVariant.text,
          platforms: selectedPlatforms,
          mediaUrls: mediaUrl ? [mediaUrl] : undefined,
          mediaType,
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
      const mediaUrl = activeTab === 'video' ? generatedVideoUrl : currentImageUrl
      const mediaType = activeTab === 'video' ? 'video' : mediaUrl ? 'image' : undefined

      const res = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: generatedContent.id,
          text: firstVariant.text,
          platforms: selectedPlatforms,
          scheduleFor: scheduledFor,
          mediaUrls: mediaUrl ? [mediaUrl] : undefined,
          mediaType,
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
            Video Post
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

        {/* Video Post Tab */}
        <TabsContent value="video" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Video Post</CardTitle>
              <CardDescription>
                Generate a video with AI, then generate a caption to post it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Model Selection */}
              <div className="space-y-2">
                <Label>Video Model</Label>
                <div className="flex gap-3">
                  <Button
                    variant={videoModel === 'fast' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVideoModel('fast')}
                  >
                    Fast (~$0.02)
                  </Button>
                  <Button
                    variant={videoModel === 'quality' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVideoModel('quality')}
                  >
                    Quality (~$0.50)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {videoModel === 'fast'
                    ? 'LTX Video -- fast generation, good for testing and drafts'
                    : 'Minimax Video -- higher quality, better for final posts'}
                </p>
              </div>

              {/* Optional: Generate starting image */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use-image"
                    checked={useImageForVideo}
                    onChange={(e) => setUseImageForVideo(e.target.checked)}
                    className="rounded border-border"
                  />
                  <Label htmlFor="use-image" className="cursor-pointer">
                    Start from an AI-generated image (image-to-video)
                  </Label>
                </div>

                {useImageForVideo && (
                  <div className="space-y-3 pl-6 border-l-2 border-border">
                    <textarea
                      placeholder="Describe the starting image for your video..."
                      className="w-full min-h-20 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      value={videoImagePrompt}
                      onChange={(e) => setVideoImagePrompt(e.target.value)}
                    />
                    <Button
                      onClick={handleGenerateVideoImage}
                      disabled={!videoImagePrompt || generatingVideoImage}
                      size="sm"
                      className="gap-2"
                    >
                      {generatingVideoImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Image...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4" />
                          Generate Starting Image
                        </>
                      )}
                    </Button>
                    {videoImageUrl && (
                      <div className="rounded-lg overflow-hidden border bg-muted max-w-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={videoImageUrl} alt="Starting frame" className="w-full h-auto" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Video prompt */}
              <div className="space-y-2">
                <Label htmlFor="video-gen-prompt">Describe the video you want to generate</Label>
                <textarea
                  id="video-gen-prompt"
                  placeholder="e.g., A smooth camera pan across a futuristic office, holographic screens showing AI voice agent dashboards, blue ambient lighting, cinematic quality..."
                  className="w-full min-h-28 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                />
              </div>

              <Button
                onClick={handleGenerateVideo}
                disabled={!videoPrompt || generatingVideo || (useImageForVideo && !videoImageUrl)}
                className="gap-2"
              >
                {generatingVideo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Video...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Generate Video
                  </>
                )}
              </Button>
              {useImageForVideo && !videoImageUrl && videoPrompt && (
                <p className="text-xs text-muted-foreground">Generate a starting image first</p>
              )}

              {/* Video Generation Progress */}
              {generatingVideo && (
                <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <Video className="h-4 w-4 absolute top-3 left-3 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Generating your video...</p>
                      <p className="text-xs text-muted-foreground">
                        {videoModel === 'quality'
                          ? 'Quality mode takes 1-3 minutes. Please wait.'
                          : 'Fast mode takes 10-30 seconds.'}
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              )}

              {/* Video Preview */}
              {generatedVideoUrl && (
                <div className="space-y-2">
                  <Label>Video Preview</Label>
                  <div className="rounded-lg overflow-hidden border bg-muted max-w-md">
                    <video
                      src={generatedVideoUrl}
                      controls
                      className="w-full h-auto"
                      autoPlay
                      muted
                      loop
                    />
                  </div>
                </div>
              )}

              {/* Caption Generation */}
              {generatedVideoUrl && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="video-caption-prompt">What should the caption be about?</Label>
                    <textarea
                      id="video-caption-prompt"
                      placeholder="e.g., Showcase our AI technology and how it helps businesses automate customer calls..."
                      className="w-full min-h-24 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={!prompt || !selectedPlatforms.length || generating}
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
                </div>
              )}
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
              {currentImageUrl && activeTab !== 'video' && <Badge variant="secondary">With image</Badge>}
              {generatedVideoUrl && activeTab === 'video' && <Badge variant="secondary">With video</Badge>}
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
                    {generatedVideoUrl && activeTab === 'video' ? (
                      <div className="rounded overflow-hidden border bg-muted">
                        <video src={generatedVideoUrl} className="w-full h-32 object-cover" muted autoPlay loop />
                      </div>
                    ) : currentImageUrl ? (
                      <div className="rounded overflow-hidden border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={currentImageUrl} alt="Post image" className="w-full h-32 object-cover" />
                      </div>
                    ) : null}
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
