'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Sparkles,
  Calendar,
  Zap,
  BarChart3,
  Link2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Palette,
  FolderOpen,
  Megaphone,
  LayoutTemplate,
  Lock,
  TrendingUp,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'

interface NavItem {
  title: string
  href: string
  icon: typeof LayoutDashboard
  minTier?: 'creator' | 'pro' | 'agency' // undefined = available to all
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Brand', href: '/brand', icon: Palette },
  { title: 'Content', href: '/content', icon: Sparkles },
  { title: 'Media', href: '/media', icon: FolderOpen },
  { title: 'Schedule', href: '/schedule', icon: Calendar },
  { title: 'Automations', href: '/automations', icon: Zap, minTier: 'pro' },
  { title: 'Analytics', href: '/analytics', icon: BarChart3 },
  { title: 'Growth', href: '/growth', icon: TrendingUp },
]

const secondaryNavItems: NavItem[] = [
  { title: 'Platforms', href: '/platforms', icon: Link2 },
  { title: 'Settings', href: '/settings', icon: Settings },
]

const TIER_ORDER = ['free', 'creator', 'pro', 'agency']

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore()
  const [userTier, setUserTier] = useState<string>('free')

  useEffect(() => {
    fetch('/api/tier')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.tier) setUserTier(data.tier)
      })
      .catch(() => {})
  }, [])

  function isTierSufficient(minTier?: string): boolean {
    if (!minTier) return true
    return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(minTier)
  }

  function renderNavItem(item: NavItem) {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
    const isLocked = !isTierSufficient(item.minTier)

    if (isLocked) {
      return (
        <button
          key={item.href}
          onClick={() => router.push('/pricing')}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full',
            'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 cursor-pointer',
            sidebarCollapsed && 'justify-center px-2'
          )}
          title={sidebarCollapsed ? `${item.title} (${item.minTier}+ plan)` : undefined}
        >
          <item.icon className="h-5 w-5 flex-shrink-0 opacity-50" />
          {!sidebarCollapsed && (
            <>
              <span className="opacity-50">{item.title}</span>
              <Lock className="h-3 w-3 ml-auto opacity-40" />
            </>
          )}
        </button>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          sidebarCollapsed && 'justify-center px-2'
        )}
        title={sidebarCollapsed ? item.title : undefined}
      >
        <item.icon className={cn(
          'h-5 w-5 flex-shrink-0 transition-colors',
          isActive ? 'text-primary' : ''
        )} />
        {!sidebarCollapsed && <span>{item.title}</span>}
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200',
        sidebarCollapsed ? 'w-[68px]' : 'w-[240px]',
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-primary text-white font-bold text-sm shadow-glow">
            S
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-lg tracking-tight">
              SocialFly
            </span>
          )}
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {mainNavItems.map(renderNavItem)}

        <div className="py-4">
          <div className={cn(
            'h-px bg-sidebar-border',
            sidebarCollapsed ? 'mx-2' : ''
          )} />
        </div>

        {secondaryNavItems.map(renderNavItem)}
      </nav>

      {/* Collapse Button */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            'w-full justify-start gap-3 text-muted-foreground hover:text-foreground',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
