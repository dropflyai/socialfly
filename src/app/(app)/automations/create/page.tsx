'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, Calendar, Newspaper, ShoppingBag, RefreshCw,
  Instagram, Facebook, Twitter, ArrowLeft, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const automationTypes = [
  {
    id: 'content_calendar',
    name: 'Content Calendar',
    description: 'AI generates a week of posts with optimized timing and content mix',
    icon: Calendar,
    color: 'text-blue-500 bg-blue-50',
    config: { postsPerDay: 2, themes: [] },
  },
  {
    id: 'ai_news',
    name: 'AI News Posts',
    description: 'Auto-fetch daily AI news and turn it into branded social posts',
    icon: Newspaper,
    color: 'text-purple-500 bg-purple-50',
    config: { maxNewsItems: 3, postsPerItem: 1 },
  },
  {
    id: 'product_ad',
    name: 'Product Ads',
    description: 'Generate pain-point based ads for your products with AI images',
    icon: ShoppingBag,
    color: 'text-green-500 bg-green-50',
    config: { product: '', painPoints: [] },
  },
  {
    id: 'repurpose',
    name: 'Repurpose Top Posts',
    description: 'Automatically adapt your best-performing posts for other platforms',
    icon: RefreshCw,
    color: 'text-orange-500 bg-orange-50',
    config: { minEngagement: 10, targetPlatforms: [] },
  },
]

const platformOptions = [
  { id: 'instagram', name: 'Instagram', icon: Instagram },
  { id: 'facebook', name: 'Facebook', icon: Facebook },
  { id: 'linkedin', name: 'LinkedIn', icon: Facebook },
  { id: 'tiktok', name: 'TikTok', icon: Instagram },
]

const schedules = [
  { id: 'daily', name: 'Daily', description: 'Runs every day' },
  { id: 'weekdays', name: 'Weekdays', description: 'Mon-Fri only' },
  { id: 'weekly', name: 'Weekly', description: 'Once per week' },
  { id: 'biweekly', name: 'Bi-weekly', description: 'Every 2 weeks' },
]

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
}

export default function CreateAutomationPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram'])
  const [selectedSchedule, setSelectedSchedule] = useState('daily')
  const [creating, setCreating] = useState(false)

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleCreate() {
    if (!name || !selectedType || !selectedPlatforms.length) return

    setCreating(true)
    try {
      const typeInfo = automationTypes.find(t => t.id === selectedType)
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: selectedType,
          config: typeInfo?.config || {},
          platforms: selectedPlatforms,
          schedule: selectedSchedule,
        }),
      })

      if (res.ok) {
        router.push('/automations')
      }
    } catch (e) {
      console.error('Create error:', e)
    }
    setCreating(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/automations"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Automation</h1>
          <p className="text-muted-foreground">Step {step} of 4</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      {/* Step 1: Choose Type */}
      {step === 1 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">What should this automation do?</h2>
          {automationTypes.map(type => {
            const Icon = type.icon
            const isSelected = selectedType === type.id
            return (
              <Card
                key={type.id}
                className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
                onClick={() => setSelectedType(type.id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`rounded-lg p-3 ${type.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{type.name}</h3>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                  {isSelected && <Check className="h-5 w-5 text-primary" />}
                </CardContent>
              </Card>
            )
          })}
          <Button onClick={() => setStep(2)} disabled={!selectedType} className="w-full">
            Next
          </Button>
        </div>
      )}

      {/* Step 2: Choose Platforms */}
      {step === 2 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Which platforms?</h2>
          <div className="grid gap-3 grid-cols-3">
            {platformOptions.map(platform => {
              const Icon = platform.icon
              const isSelected = selectedPlatforms.includes(platform.id)
              return (
                <Card
                  key={platform.id}
                  className={`cursor-pointer transition-all text-center ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}
                  onClick={() => togglePlatform(platform.id)}
                >
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <Icon className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">{platform.name}</span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(3)} disabled={!selectedPlatforms.length} className="flex-1">Next</Button>
          </div>
        </div>
      )}

      {/* Step 3: Choose Schedule */}
      {step === 3 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">How often?</h2>
          {schedules.map(sched => (
            <Card
              key={sched.id}
              className={`cursor-pointer transition-all ${selectedSchedule === sched.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
              onClick={() => setSelectedSchedule(sched.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{sched.name}</h3>
                  <p className="text-sm text-muted-foreground">{sched.description}</p>
                </div>
                {selectedSchedule === sched.id && <Check className="h-5 w-5 text-primary" />}
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(4)} className="flex-1">Next</Button>
          </div>
        </div>
      )}

      {/* Step 4: Name & Confirm */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Name your automation</h2>
          <Input
            placeholder="e.g., Daily AI News Posts"
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-lg"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <Badge>{automationTypes.find(t => t.id === selectedType)?.name}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platforms</span>
                <div className="flex gap-1">
                  {selectedPlatforms.map(p => {
                    const Icon = platformIcons[p] || Zap
                    return <Icon key={p} className="h-4 w-4" />
                  })}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Schedule</span>
                <span>{schedules.find(s => s.id === selectedSchedule)?.name}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
            <Button onClick={handleCreate} disabled={!name || creating} className="flex-1 gap-2">
              {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Automation'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
