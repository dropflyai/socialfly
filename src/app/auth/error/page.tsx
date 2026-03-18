'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>

        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-6">
          We couldn't complete your authentication. This might happen if the link expired or was already used.
        </p>

        <div className="space-y-4">
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center w-full gap-2 bg-primary text-primary-foreground font-medium py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors shadow-glow"
          >
            Try signing up again
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
