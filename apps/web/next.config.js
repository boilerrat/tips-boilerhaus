const path = require('path')
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker — produces a minimal self-contained Node server
  output: 'standalone',

  // Disable x-powered-by header
  poweredByHeader: false,

  reactStrictMode: true,

  // Transpile monorepo packages consumed by this app
  transpilePackages: ['@tips/shared'],

  experimental: {
    // Required for pnpm monorepos: tells Next.js file-tracer to resolve
    // dependencies relative to the monorepo root so it correctly follows
    // pnpm's virtual-store symlinks (node_modules/.pnpm/...) when building
    // the standalone output. Without this, traced deps can be silently
    // omitted, causing the server to crash with MODULE_NOT_FOUND at runtime.
    outputFileTracingRoot: path.join(__dirname, '../../'),

    // Required for Sentry server-side init via instrumentation.ts (Next.js 14)
    instrumentationHook: true,
  },
}

// Wrap with Sentry only when DSN is configured — allows builds without Sentry
const sentryConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // Suppress source map upload logs during build
      silent: !process.env.CI,

      // Widen client file upload for better stack traces
      widenClientFileUpload: true,

      // Tree-shake Sentry logger statements to reduce bundle size
      disableLogger: true,

      // Hide source maps from the browser bundle
      hideSourceMaps: true,

      // Route browser requests through a Next.js rewrite to avoid ad-blockers
      tunnelRoute: '/monitoring',
    })
  : nextConfig

module.exports = sentryConfig
