'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Zap, Plus, Play, Pause, History, Trash2, Clock, Calendar,
  Instagram, Facebook, Twitter, RefreshCw, ToggleLeft, ToggleRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface AutomationRule {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  platforms: string[]
  schedule: string
  status: string
  last_run: string | null
  run_count: number
  created_at: string
}

const typeLabels: Record<string, { label: string; color: string }> = {
  content_calendar: { label: 'Content Calendar', color: 'bg-blue-100 text-blue-800' },
  ai_news: { label: 'AI News Posts', color: 'bg-purple-100 text-purple-800' },
  product_ad: { label: 'Product Ads', color: 'bg-green-100 text-green-800' },
  repurpose: { label: 'Repurpose Top Posts', color: 'bg-orange-100 text-orange-800' },
  custom: { label: 'Custom', color: 'bg-gray-100 text-gray-800' },
}

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchRules() {
    setLoading(true)
    try {
      const res = await fetch('/api/automations')
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules || [])
      }
    } catch (e) {
      console.error('Fetch error:', e)
    }
    setLoading(false)
  }

  async function toggleRule(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await fetch(`/api/automations?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchRules()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this automation rule?')) return
    await fetch(`/api/automations?id=${id}`, { method: 'DELETE' })
    fetchRules()
  }

  useEffect(() => { fetchRules() }, [])

  const activeRules = rules.filter(r => r.status === 'active')
  const pausedRules = rules.filter(r => r.status === 'paused')

  function RuleCard({ rule }: { rule: AutomationRule }) {
    const typeInfo = typeLabels[rule.type] || typeLabels.custom
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <h3 className="font-semibold">{rule.name}</h3>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={typeInfo.color}>{typeInfo.label}</Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {rule.schedule}
                </Badge>
                {rule.platforms.map(p => {
                  const Icon = platformIcons[p] || Zap
                  return <Icon key={p} className="h-4 w-4 text-muted-foreground" />
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Runs: {rule.run_count}</span>
                {rule.last_run && (
                  <span>Last: {new Date(rule.last_run).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleRule(rule.id, rule.status)}
                title={rule.status === 'active' ? 'Pause' : 'Activate'}
              >
                {rule.status === 'active' ? (
                  <ToggleRight className="h-5 w-5 text-green-500" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteRule(rule.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
          <p className="text-muted-foreground">Set rules to run your social media on autopilot</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchRules} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild className="gap-2">
            <Link href="/automations/create">
              <Plus className="h-4 w-4" />
              Create Rule
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Play className="h-4 w-4" />
            Active ({activeRules.length})
          </TabsTrigger>
          <TabsTrigger value="paused" className="gap-2">
            <Pause className="h-4 w-4" />
            Paused ({pausedRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {activeRules.length > 0 ? (
            activeRules.map(rule => <RuleCard key={rule.id} rule={rule} />)
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">No active automations</CardTitle>
                <CardDescription className="text-center max-w-sm mb-6">
                  Create automation rules to post content, generate ideas, or repurpose top performers automatically.
                </CardDescription>
                <Button asChild className="gap-2">
                  <Link href="/automations/create">
                    <Plus className="h-4 w-4" />
                    Create your first automation
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="paused" className="space-y-3">
          {pausedRules.length > 0 ? (
            pausedRules.map(rule => <RuleCard key={rule.id} rule={rule} />)
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Pause className="h-8 w-8 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">No paused rules</CardTitle>
                <CardDescription>Paused automation rules will appear here</CardDescription>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
