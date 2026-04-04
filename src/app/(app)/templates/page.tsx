'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TemplatesPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/content/create')
  }, [router])

  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      Redirecting to Content...
    </div>
  )
}
