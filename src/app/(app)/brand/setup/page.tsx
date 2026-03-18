'use client'

/*
 * BRAND SETUP - Design Intent Declaration
 *
 * User type: New user setting up their brand
 * Primary decision: Enter URL to analyze
 * Excluded on purpose: Advanced settings, manual brand configuration
 * Failure definition: User doesn't understand what to enter or why
 * UI Mode: MODE_SAAS
 *
 * Design principles:
 * - ONE primary action (enter URL)
 * - Clear progress indication
 * - Calm, direct copy (not marketing-speak)
 * - Analysis results are scannable, not overwhelming
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Loader2,
  CheckCircle2,
  Sparkles,
  Users,
  Palette,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Step = 'input' | 'analyzing' | 'review' | 'complete'

interface BrandAnalysis {
  voice: {
    tone: string
    personality: { traits: string[]; description: string }
    vocabulary: string[]
  }
  audience: {
    demographics: Record<string, string>
    interests: string[]
    painPoints: string[]
  }
  content: {
    pillars: Array<{ name: string; description: string }>
  }
  visualStyle: {
    style: string
    colors: { primary: string; secondary: string; accent?: string }
  }
  summary: string
}

export default function BrandSetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<BrandAnalysis | null>(null)
  const [brandName, setBrandName] = useState('')

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Enter your website URL')
      return
    }

    setError(null)
    setStep('analyzing')

    try {
      const response = await fetch('/api/brand/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          analysisDepth: 'standard',
          createProfile: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      setAnalysis(data.analysis)
      setBrandName(data.brandProfile?.name || 'Your Brand')
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('input')
    }
  }

  const handleComplete = () => {
    setStep('complete')
    setTimeout(() => router.push('/brand'), 1500)
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {['input', 'analyzing', 'review'].map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              ['input', 'analyzing', 'review', 'complete'].indexOf(step) >= i
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Step: Input URL */}
      {step === 'input' && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Set up your brand
          </h1>
          <p className="text-muted-foreground mb-8">
            Enter your website URL. We'll analyze your content to understand your
            voice, audience, and visual style.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">Website URL</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="pl-10 h-12 text-base"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              size="lg"
              className="w-full shadow-glow"
            >
              Analyze brand
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              This takes about 30 seconds. We scan your website's content, not
              private data.
            </p>
          </div>
        </div>
      )}

      {/* Step: Analyzing */}
      {step === 'analyzing' && (
        <div className="text-center py-12">
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-2">Analyzing your brand</h2>
          <p className="text-muted-foreground mb-8">
            Scanning content and extracting your brand profile...
          </p>

          <div className="space-y-3 text-sm text-left max-w-xs mx-auto">
            <AnalysisStep label="Extracting content" done />
            <AnalysisStep label="Analyzing voice and tone" active />
            <AnalysisStep label="Identifying audience" />
            <AnalysisStep label="Building content pillars" />
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && analysis && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            {brandName}
          </h1>
          <p className="text-muted-foreground mb-8">{analysis.summary}</p>

          <div className="space-y-6">
            {/* Voice */}
            <ReviewSection
              icon={Sparkles}
              title="Brand Voice"
              content={
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium capitalize">
                      {analysis.voice.tone}
                    </span>
                    {analysis.voice.personality.traits.slice(0, 2).map((trait) => (
                      <span
                        key={trait}
                        className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {analysis.voice.personality.description}
                  </p>
                </div>
              }
            />

            {/* Audience */}
            <ReviewSection
              icon={Users}
              title="Target Audience"
              content={
                <div className="space-y-2">
                  <p className="text-sm">
                    {analysis.audience.demographics.ageRange} ·{' '}
                    {analysis.audience.demographics.gender}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.audience.interests.slice(0, 4).map((interest) => (
                      <span
                        key={interest}
                        className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              }
            />

            {/* Visual */}
            <ReviewSection
              icon={Palette}
              title="Visual Style"
              content={
                <div className="flex items-center gap-4">
                  <span className="text-sm capitalize">
                    {analysis.visualStyle.style}
                  </span>
                  <div className="flex gap-1">
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow"
                      style={{
                        backgroundColor: analysis.visualStyle.colors.primary,
                      }}
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow"
                      style={{
                        backgroundColor: analysis.visualStyle.colors.secondary,
                      }}
                    />
                  </div>
                </div>
              }
            />
          </div>

          <div className="flex gap-3 mt-8">
            <Button
              variant="outline"
              onClick={() => setStep('input')}
              className="flex-1"
            >
              Start over
            </Button>
            <Button onClick={handleComplete} className="flex-1 shadow-glow">
              Save profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-500/10 mb-6">
            <CheckCircle2 className="h-8 w-8 text-teal-500" />
          </div>

          <h2 className="text-xl font-semibold mb-2">Brand profile created</h2>
          <p className="text-muted-foreground">
            Redirecting to your brand profile...
          </p>
        </div>
      )}
    </div>
  )
}

function AnalysisStep({
  label,
  done,
  active,
}: {
  label: string
  done?: boolean
  active?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-teal-500" />
      ) : active ? (
        <Loader2 className="h-4 w-4 text-primary animate-spin" />
      ) : (
        <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
      )}
      <span className={active ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  )
}

function ReviewSection({
  icon: Icon,
  title,
  content,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  content: React.ReactNode
}) {
  return (
    <div className="flex gap-4 p-4 rounded-xl bg-muted/30">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium mb-2">{title}</h3>
        {content}
      </div>
    </div>
  )
}
