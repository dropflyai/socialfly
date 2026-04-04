import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

// GET /api/onboarding — returns onboarding checklist status
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  // Check each step in parallel
  const [brandRes, platformRes, mediaRes, contentRes, automationRes, analyticsRes] = await Promise.all([
    serviceClient.from('brand_profiles').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    serviceClient.from('platform_connections').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active'),
    serviceClient.from('brand_assets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    serviceClient.from('scheduled_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['posted', 'scheduled', 'partial']),
    serviceClient.from('automation_rules').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    serviceClient.from('scheduled_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'posted'),
  ])

  const steps = [
    {
      id: 'brand',
      title: 'Set up your brand profile',
      description: 'We\'ll analyze your website to understand your voice, audience, and style.',
      href: '/brand/setup',
      completed: (brandRes.count || 0) > 0,
    },
    {
      id: 'platform',
      title: 'Connect a social platform',
      description: 'Link Instagram, Facebook, LinkedIn, or TikTok to start posting.',
      href: '/platforms',
      completed: (platformRes.count || 0) > 0,
    },
    {
      id: 'media',
      title: 'Upload media to your library',
      description: 'Add photos and videos to use in your posts and automations.',
      href: '/media',
      completed: (mediaRes.count || 0) > 0,
    },
    {
      id: 'content',
      title: 'Create your first post',
      description: 'Generate AI content with captions, images, or video and publish it.',
      href: '/content/create',
      completed: (contentRes.count || 0) > 0,
    },
    {
      id: 'automation',
      title: 'Set up an automation',
      description: 'Let AI create and post content for you on a schedule.',
      href: '/automations/create',
      completed: (automationRes.count || 0) > 0,
    },
    {
      id: 'analytics',
      title: 'Review your analytics',
      description: 'See how your posts are performing across platforms.',
      href: '/analytics',
      completed: (analyticsRes.count || 0) > 0,
    },
  ]

  const completedCount = steps.filter(s => s.completed).length

  return NextResponse.json({
    steps,
    completedCount,
    totalSteps: steps.length,
    allComplete: completedCount === steps.length,
  })
}
