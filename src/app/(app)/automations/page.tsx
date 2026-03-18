'use client'

import Link from 'next/link'
import { Zap, Plus, Play, Pause, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
          <p className="text-muted-foreground">Set rules to run your social media on autopilot</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/automations/create">
            <Plus className="h-4 w-4" />
            Create Rule
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Play className="h-4 w-4" />
            Active Rules
          </TabsTrigger>
          <TabsTrigger value="paused" className="gap-2">
            <Pause className="h-4 w-4" />
            Paused
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl mb-2">No active automations</CardTitle>
              <CardDescription className="text-center max-w-sm mb-6">
                Create automation rules to post content, generate ideas, or respond to trends automatically.
              </CardDescription>
              <Button asChild className="gap-2">
                <Link href="/automations/create">
                  <Plus className="h-4 w-4" />
                  Create your first automation
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paused">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Pause className="h-8 w-8 text-muted-foreground mb-4" />
              <CardTitle className="text-xl mb-2">No paused rules</CardTitle>
              <CardDescription>Paused automation rules will appear here</CardDescription>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <History className="h-8 w-8 text-muted-foreground mb-4" />
              <CardTitle className="text-xl mb-2">No execution history</CardTitle>
              <CardDescription>Automation execution logs will appear here</CardDescription>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
