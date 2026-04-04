'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const ISSUE_OPTIONS = [
  { id: 'wrong_topic', label: 'Wrong topic', description: 'Not what I want to post about' },
  { id: 'wrong_tone', label: 'Wrong tone', description: 'Too formal, too casual, etc.' },
  { id: 'too_salesy', label: 'Too promotional', description: 'Too many CTAs or sales-y' },
  { id: 'too_generic', label: 'Too generic', description: 'Boring, could be anyone\'s post' },
  { id: 'off_brand', label: 'Doesn\'t sound like us', description: 'Not our voice or style' },
  { id: 'wrong_length', label: 'Wrong length', description: 'Too long or too short' },
]

interface RejectFeedbackDialogProps {
  postText: string
  ruleId: string
  onSubmit: () => void
  onCancel: () => void
}

export function RejectFeedbackDialog({ postText, ruleId, onSubmit, onCancel }: RejectFeedbackDialogProps) {
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  const [suggestion, setSuggestion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function toggleIssue(id: string) {
    setSelectedIssues(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  async function handleSubmit() {
    if (selectedIssues.length === 0) return
    setSubmitting(true)

    try {
      // Save feedback
      await fetch('/api/automations/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId,
          rejectedText: postText,
          issues: selectedIssues,
          suggestion: suggestion.trim() || undefined,
        }),
      })

      onSubmit()
    } catch {
      // Still reject even if feedback save fails
      onSubmit()
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl border shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Help us improve</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Rejected text preview */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Rejected post:</p>
            <p className="text-sm line-clamp-3">{postText}</p>
          </div>

          {/* Issue selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium">What was the issue?</p>
            <div className="grid gap-2">
              {ISSUE_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => toggleIssue(option.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedIssues.includes(option.id)
                      ? 'ring-2 ring-primary bg-primary/5 border-primary/30'
                      : 'hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{option.label}</span>
                    {selectedIssues.includes(option.id) && (
                      <Badge variant="secondary" className="text-[10px]">Selected</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Free text suggestion */}
          <div className="space-y-2">
            <p className="text-sm font-medium">What would make it better? <span className="text-muted-foreground font-normal">(optional)</span></p>
            <textarea
              className="w-full min-h-16 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              placeholder="e.g., Use more emojis, talk about pricing, be more direct..."
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Skip</Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIssues.length === 0 || submitting}
            className="flex-1 gap-1"
            variant="destructive"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Reject & Save Feedback
          </Button>
        </div>
      </div>
    </div>
  )
}
