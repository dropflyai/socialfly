'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link2, Plus, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PlatformConnection {
  id: string
  platform: string
  profile_name: string
  profile_handle: string
  profile_image_url: string | null
  status: string
  connected_at: string
  last_sync_at: string | null
  error_message: string | null
}

const platformConfig: Record<string, { name: string; description: string; icon: string; color: string; comingSoon?: boolean }> = {
  instagram: {
    name: 'Instagram',
    description: 'Share photos, videos, and stories',
    icon: '\ud83d\udcf8',
    color: 'from-purple-500 via-pink-500 to-orange-500',
  },
  facebook: {
    name: 'Facebook',
    description: 'Post to your Facebook Page',
    icon: '\ud83d\udc4d',
    color: 'from-blue-600 to-blue-400',
  },
  linkedin: {
    name: 'LinkedIn',
    description: 'Share professional updates and articles',
    icon: '\ud83d\udcbc',
    color: 'from-blue-700 to-blue-500',
  },
  tiktok: {
    name: 'TikTok',
    description: 'Create and share short videos',
    icon: '\ud83c\udfb5',
    color: 'from-black to-gray-800',
  },
  twitter: {
    name: 'X (Twitter)',
    description: 'Share thoughts and updates',
    icon: '\ud835\udd4f',
    color: 'from-gray-900 to-gray-700',
    comingSoon: true,
  },
}

const supportedPlatforms = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter']

export default function PlatformsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-48" /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-48 bg-muted rounded" />)}</div></div>}>
      <PlatformsContent />
    </Suspense>
  )
}

function PlatformsContent() {
  const [connections, setConnections] = useState<PlatformConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const connectedPlatform = searchParams.get('connected')
  const errorMessage = searchParams.get('error')

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/platforms')
      const data = await res.json()
      setConnections(data.connections || [])
    } catch (err) {
      console.error('Failed to fetch connections:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleConnect = (platformId: string) => {
    // Redirect to OAuth flow
    window.location.href = `/api/auth/connect/${platformId}`
  }

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform)
    try {
      await fetch(`/api/platforms?platform=${platform}`, { method: 'DELETE' })
      await fetchConnections()
    } catch (err) {
      console.error('Failed to disconnect:', err)
    } finally {
      setDisconnecting(null)
    }
  }

  const getConnection = (platform: string) =>
    connections.find((c) => c.platform === platform)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platforms</h1>
          <p className="text-muted-foreground">Connect and manage your social media accounts</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchConnections}>
          <RefreshCw className="h-4 w-4" />
          Sync All
        </Button>
      </div>

      {/* Success / Error notifications */}
      {connectedPlatform && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Successfully connected {platformConfig[connectedPlatform]?.name || connectedPlatform}!</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <XCircle className="h-4 w-4" />
          <span className="text-sm">Connection error: {decodeURIComponent(errorMessage)}</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {supportedPlatforms.map((p) => (
            <Card key={p} className="animate-pulse">
              <CardHeader><div className="h-12 bg-muted rounded" /></CardHeader>
              <CardContent><div className="h-10 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {supportedPlatforms.map((platformId) => {
            const config = platformConfig[platformId]
            const connection = getConnection(platformId)
            const isConnected = connection?.status === 'active'
            const hasError = connection?.status === 'error'
            const isComingSoon = config.comingSoon

            return (
              <Card key={platformId} className={`relative overflow-hidden ${isComingSoon ? 'opacity-60' : ''}`}>
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.color}`} />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{config.name}</CardTitle>
                        <CardDescription className="text-sm">{config.description}</CardDescription>
                      </div>
                    </div>
                    {isComingSoon ? (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        Coming Soon
                      </Badge>
                    ) : isConnected ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Connected
                      </Badge>
                    ) : hasError ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Error
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
                  {isComingSoon ? (
                    <Button disabled className="w-full gap-2">
                      <Plus className="h-4 w-4" />
                      Coming Soon
                    </Button>
                  ) : isConnected ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Account:</span>
                        <span className="font-medium">@{connection.profile_handle}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Connected:</span>
                        <span className="font-medium">
                          {new Date(connection.connected_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive flex-1"
                          onClick={() => handleDisconnect(platformId)}
                          disabled={disconnecting === platformId}
                        >
                          {disconnecting === platformId ? 'Disconnecting...' : 'Disconnect'}
                        </Button>
                      </div>
                    </div>
                  ) : hasError ? (
                    <div className="space-y-3">
                      <p className="text-sm text-red-400">{connection?.error_message || 'Connection error'}</p>
                      <Button onClick={() => handleConnect(platformId)} className="w-full gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Reconnect
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => handleConnect(platformId)} className="w-full gap-2">
                      <Plus className="h-4 w-4" />
                      Connect {config.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

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
