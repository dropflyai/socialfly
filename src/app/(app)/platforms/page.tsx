'use client'

import { useState } from 'react'
import { Link2, Plus, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const platforms = [
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Share photos, videos, and stories',
    icon: '📸',
    color: 'from-purple-500 via-pink-500 to-orange-500',
    connected: false,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Create and share short videos',
    icon: '🎵',
    color: 'from-black to-gray-800',
    connected: false,
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    description: 'Share thoughts and updates',
    icon: '𝕏',
    color: 'from-gray-900 to-gray-700',
    connected: false,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Professional networking and content',
    icon: '💼',
    color: 'from-blue-700 to-blue-600',
    connected: false,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Connect with friends and pages',
    icon: '👥',
    color: 'from-blue-600 to-blue-500',
    connected: false,
  },
]

export default function PlatformsPage() {
  const [connecting, setConnecting] = useState<string | null>(null)

  const handleConnect = async (platformId: string) => {
    setConnecting(platformId)
    // TODO: Implement OAuth connection via Ayrshare
    await new Promise(resolve => setTimeout(resolve, 1500))
    setConnecting(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platforms</h1>
          <p className="text-muted-foreground">Connect and manage your social media accounts</p>
        </div>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Sync All
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => (
          <Card key={platform.id} className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${platform.color}`} />
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{platform.name}</CardTitle>
                    <CardDescription className="text-sm">{platform.description}</CardDescription>
                  </div>
                </div>
                {platform.connected ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Not connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {platform.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Account:</span>
                    <span className="font-medium">@username</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last synced:</span>
                    <span className="font-medium">Just now</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Profile
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => handleConnect(platform.id)}
                  disabled={connecting === platform.id}
                  className="w-full gap-2"
                >
                  {connecting === platform.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Connect {platform.name}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="flex items-start gap-4 pt-6">
          <div className="rounded-full bg-primary/10 p-2">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium mb-1">Secure Connection</h3>
            <p className="text-sm text-muted-foreground">
              We use OAuth to securely connect to your social accounts. We never store your passwords
              and you can disconnect at any time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
