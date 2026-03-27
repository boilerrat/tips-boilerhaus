/**
 * Global error boundary — catches unhandled errors in the root layout.
 *
 * Reports errors to Sentry and provides a minimal recovery UI.
 * Must be a Client Component.
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-black text-white flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-zinc-400">
            An unexpected error occurred. The error has been reported.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
