const path = require('path')

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
  },
}

module.exports = nextConfig
