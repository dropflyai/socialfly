'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  Sparkles,
  Palette,
  Users,
  FileText,
  Settings,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  Edit,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface BrandProfile {
  id: string
  name: string
  description: string | null
  source_url: string | null
  source_type: string
  voice_tone: string
  voice_description: string | null
  voice_vocabulary: string[]
  color_primary: string
  color_secondary: string
  color_accent: string | null
  image_style: string | null
  target_audience: string | null
  target_interests: string[]
  content_pillars: string[]
  hashtag_sets: Record<string, string[]>
  is_default: boolean
  created_at: string
  updated_at: string
}

export default function BrandPage() {
  const [brands, setBrands] = useState<BrandProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState<BrandProfile | null>(null)

  useEffect(() => {
    fetchBrands()
  }, [])

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brand/analyze')
      const data = await response.json()
      if (data.brandProfiles) {
        setBrands(data.brandProfiles)
        if (data.brandProfiles.length > 0 && !selectedBrand) {
          setSelectedBrand(data.brandProfiles[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch brands:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Empty state
  if (brands.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Brand Profiles</h1>
            <p className="text-muted-foreground">Manage your brand voice and identity</p>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl mb-2">No brand profiles yet</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">
              Create your first brand profile by scanning your website or describing your brand.
              We'll extract your voice, audience, and content pillars.
            </CardDescription>
            <Button asChild className="gap-2">
              <Link href="/brand/setup">
                <Plus className="h-4 w-4" />
                Create Brand Profile
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brand Profiles</h1>
          <p className="text-muted-foreground">Manage your brand voice and identity</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/brand/setup">
            <Plus className="h-4 w-4" />
            Add Brand
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        {/* Brand List */}
        <div className="space-y-2">
          {brands.map((brand) => (
            <Card
              key={brand.id}
              className={`cursor-pointer transition-all ${
                selectedBrand?.id === brand.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedBrand(brand)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: brand.color_primary }}
                  >
                    {brand.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{brand.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{brand.voice_tone}</p>
                  </div>
                  {brand.is_default && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Brand Detail */}
        {selectedBrand && (
          <div className="space-y-6">
            {/* Brand Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                      style={{ backgroundColor: selectedBrand.color_primary }}
                    >
                      {selectedBrand.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{selectedBrand.name}</CardTitle>
                      <CardDescription>
                        {selectedBrand.description || 'No description'}
                      </CardDescription>
                      {selectedBrand.source_url && (() => {
                        try {
                          const url = new URL(
                            selectedBrand.source_url.startsWith('http')
                              ? selectedBrand.source_url
                              : `https://${selectedBrand.source_url}`
                          )
                          return (
                            <a
                              href={url.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                            >
                              {url.hostname}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )
                        } catch {
                          return (
                            <span className="text-sm text-muted-foreground mt-1">
                              {selectedBrand.source_url}
                            </span>
                          )
                        }
                      })()}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2">
                        <Edit className="h-4 w-4" />
                        Edit Brand
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Re-analyze
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <Settings className="h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Delete Brand
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
            </Card>

            {/* Brand Voice */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Brand Voice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-base capitalize">
                    {selectedBrand.voice_tone}
                  </Badge>
                </div>
                {selectedBrand.voice_description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedBrand.voice_description}
                  </p>
                )}
                {selectedBrand.voice_vocabulary.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Key Vocabulary</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedBrand.voice_vocabulary.slice(0, 15).map((word) => (
                        <Badge key={word} variant="outline" className="text-xs">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visual Style */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Visual Style
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {selectedBrand.image_style && (
                    <Badge variant="secondary" className="capitalize">
                      {selectedBrand.image_style}
                    </Badge>
                  )}
                  <div className="flex gap-2">
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-white shadow"
                      style={{ backgroundColor: selectedBrand.color_primary }}
                      title="Primary"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-white shadow"
                      style={{ backgroundColor: selectedBrand.color_secondary }}
                      title="Secondary"
                    />
                    {selectedBrand.color_accent && (
                      <div
                        className="w-10 h-10 rounded-lg border-2 border-white shadow"
                        style={{ backgroundColor: selectedBrand.color_accent }}
                        title="Accent"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Audience */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Target Audience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedBrand.target_audience && (
                  <p className="text-sm text-muted-foreground">
                    {selectedBrand.target_audience}
                  </p>
                )}
                {selectedBrand.target_interests.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Interests</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedBrand.target_interests.slice(0, 8).map((interest) => (
                        <Badge key={interest} variant="outline" className="text-xs">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Content Pillars */}
            {selectedBrand.content_pillars.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Content Pillars
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedBrand.content_pillars.map((pillar) => (
                      <Badge key={pillar} variant="secondary">
                        {pillar}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hashtags */}
            {Object.keys(selectedBrand.hashtag_sets).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Hashtag Sets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(selectedBrand.hashtag_sets).map(([category, tags]) => (
                    <div key={category}>
                      <p className="text-sm font-medium capitalize mb-2">{category}</p>
                      <div className="flex flex-wrap gap-1">
                        {(tags as string[]).slice(0, 10).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="flex gap-3">
              <Button asChild className="flex-1">
                <Link href="/content/create">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Content
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/automations/create">
                  Set Up Autopilot
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
