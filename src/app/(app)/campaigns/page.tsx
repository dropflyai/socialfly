'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CampaignsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/automations')
  }, [router])

  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      Redirecting to Automations...
    </div>
  )
}
