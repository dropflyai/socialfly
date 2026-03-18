'use client'

import Link from 'next/link'
import { Sparkles, Plus, Filter, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Library</h1>
          <p className="text-muted-foreground">Create, manage, and organize your content</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/content/create">
            <Plus className="h-4 w-4" />
            Create Content
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search content..." className="pl-9" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Empty State */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl mb-2">No content yet</CardTitle>
          <CardDescription className="text-center max-w-sm mb-6">
            Your content library is empty. Create your first piece of content with AI assistance.
          </CardDescription>
          <Button asChild className="gap-2">
            <Link href="/content/create">
              <Sparkles className="h-4 w-4" />
              Create with AI
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
