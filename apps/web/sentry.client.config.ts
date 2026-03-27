/**
 * Sentry client-side configuration.
 *
 * Initializes Sentry in the browser for error tracking and performance
 * monitoring. Loaded automatically by @sentry/nextjs via the instrumentation
 * hook and client-side webpack plugin.
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Capture 10% of transactions for performance monitoring in production.
  // Increase for debugging, decrease if volume is high.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Replay captures user sessions for debugging errors in context.
  // Only capture replays when an error occurs to minimize overhead.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  // Don't send events in development unless explicitly enabled
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})
