/**
 * Next.js instrumentation hook — App Router server-side initialization.
 *
 * Imports the appropriate Sentry config based on the runtime (Node.js or Edge).
 * Requires `experimental.instrumentationHook: true` in next.config.js (Next.js 14).
 */

import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
