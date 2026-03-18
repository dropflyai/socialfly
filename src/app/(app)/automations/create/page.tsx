'use client'

import Link from 'next/link'
import { ArrowLeft, Zap, Calendar, Sparkles, TrendingUp, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const templates = [
  {
    id: 'daily-post',
    name: 'Daily Optimal Post',
    description: 'Automatically post your best content at the optimal time each day',
    icon: Calendar,
    trigger: 'Schedule',
    action: 'Post Content',
  },
  {
    id: 'weekly-batch',
    name: 'Weekly Content Batch',
    description: "Generate a week's worth of content every Monday morning",
    icon: Sparkles,
    trigger: 'Schedule',
    action: 'Generate Content',
  },
  {
    id: 'repurpose',
    name: 'Cross-Platform Repurpose',
    description: 'Automatically adapt successful posts for other platforms',
    icon: TrendingUp,
    trigger: 'Engagement',
    action: 'Repurpose',
  },
]

export default function CreateAutomationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/automations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Automation</h1>
          <p className="text-muted-foreground">Choose a template or build from scratch</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Build from Scratch */}
        <Card className="border-dashed hover:border-primary/50 cursor-pointer transition-colors">
          <CardHeader>
            <div className="rounded-full bg-muted p-3 w-fit mb-2">
              <Zap className="h-5 w-5" />
            </div>
            <CardTitle>Build from Scratch</CardTitle>
            <CardDescription>
              Create a custom automation with your own trigger and actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Start Building
            </Button>
          </CardContent>
        </Card>

        {/* Templates */}
        {templates.map((template) => (
          <Card key={template.id} className="hover:border-primary/50 cursor-pointer transition-colors">
            <CardHeader>
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-2">
                <template.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trigger:</span>
                <span className="font-medium">{template.trigger}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Action:</span>
                <span className="font-medium">{template.action}</span>
              </div>
              <Button className="w-full">Use Template</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
