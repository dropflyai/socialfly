'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface OnboardingStep {
  id: string
  title: string
  description: string
  href: string
  completed: boolean
}

export function OnboardingChecklist() {
  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if user dismissed the checklist
    if (typeof window !== 'undefined' && localStorage.getItem('onboarding_dismissed') === 'true') {
      setDismissed(true)
      setLoading(false)
      return
    }

    fetch('/api/onboarding')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setSteps(data.steps)
          setCompletedCount(data.completedCount)
          setTotalSteps(data.totalSteps)
          if (data.allComplete) {
            // Auto-dismiss after a delay if all complete
            setTimeout(() => setDismissed(true), 5000)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleDismiss() {
    setDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_dismissed', 'true')
    }
  }

  if (loading || dismissed) return null

  const allComplete = completedCount === totalSteps
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0
  const nextStep = steps.find(s => !s.completed)

  if (allComplete) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-500/10 p-2">
              <Sparkles className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-green-500">You&apos;re all set!</p>
              <p className="text-sm text-muted-foreground">You&apos;ve completed all setup steps. Your social media is on autopilot.</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Getting Started</h3>
            <p className="text-sm text-muted-foreground">{completedCount} of {totalSteps} complete</p>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-1">
          {steps.map(step => (
            <Link
              key={step.id}
              href={step.completed ? '#' : step.href}
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                step.completed
                  ? 'opacity-60'
                  : step.id === nextStep?.id
                    ? 'bg-primary/5 hover:bg-primary/10'
                    : 'hover:bg-muted/50'
              }`}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                step.completed
                  ? 'bg-green-500/20 text-green-500'
                  : step.id === nextStep?.id
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {step.completed ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-xs font-medium">{steps.indexOf(step) + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {step.title}
                </p>
                {step.id === nextStep?.id && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
              {!step.completed && step.id === nextStep?.id && (
                <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>

        {/* Next step CTA */}
        {nextStep && (
          <Button asChild className="w-full gap-2" size="sm">
            <Link href={nextStep.href}>
              {nextStep.title}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
