'use client'

import Link from 'next/link'
import { Calendar, Plus, Clock, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">Plan and manage your posting calendar</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/content/create">
            <Plus className="h-4 w-4" />
            Schedule Post
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            <List className="h-4 w-4" />
            Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          {/* Empty State */}
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl mb-2">No posts scheduled</CardTitle>
              <CardDescription className="text-center max-w-sm mb-6">
                Schedule posts to auto-publish across your social accounts at the best times.
              </CardDescription>
              <Button asChild className="gap-2">
                <Link href="/content/create">
                  <Plus className="h-4 w-4" />
                  Schedule your first post
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl mb-2">Queue is empty</CardTitle>
              <CardDescription className="text-center max-w-sm mb-6">
                Posts in your queue will be shown here in chronological order.
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
