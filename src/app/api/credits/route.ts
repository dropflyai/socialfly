import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCreditUsage } from '@/lib/credits'
import { CREDIT_COSTS } from '@/lib/plans'

// GET /api/credits — get current credit usage for the authenticated user
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const usage = await getCreditUsage(user.id)

  return NextResponse.json({
    ...usage,
    costs: CREDIT_COSTS,
  })
}
