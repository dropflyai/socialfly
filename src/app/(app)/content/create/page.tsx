'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles, Video, FileText, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

function CreateContentContent() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('type') || 'text'

  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    // TODO: Implement content generation
    await new Promise(resolve => setTimeout(resolve, 2000))
    setGenerating(false)
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
          <p className="text-muted-foreground">Generate content with AI assistance</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            Text Content
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2">
            <Video className="h-4 w-4" />
            Video
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Content Writer</CardTitle>
              <CardDescription>
                Generate engaging captions, scripts, and posts with Claude AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">What would you like to create?</Label>
                <textarea
                  id="prompt"
                  placeholder="e.g., Write a LinkedIn post about productivity tips for entrepreneurs..."
                  className="w-full min-h-32 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4">
                <Button onClick={handleGenerate} disabled={!prompt || generating} className="gap-2">
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
                <span className="text-sm text-muted-foreground">Cost: ~5 tokens</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Video Generation</CardTitle>
              <CardDescription>
                Create videos from text prompts using FAL.AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-prompt">Describe your video</Label>
                <textarea
                  id="video-prompt"
                  placeholder="e.g., A serene ocean sunset with waves gently rolling on the shore..."
                  className="w-full min-h-32 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4">
                <Button onClick={handleGenerate} disabled={!prompt || generating} className="gap-2">
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4" />
                      Generate Video
                    </>
                  )}
                </Button>
                <span className="text-sm text-muted-foreground">Cost: 10 tokens</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
