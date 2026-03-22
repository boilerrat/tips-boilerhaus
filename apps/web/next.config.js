/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker — produces a minimal self-contained Node server
  output: 'standalone',

  // Disable x-powered-by header
  poweredByHeader: false,

  reactStrictMode: true,

  // Transpile monorepo packages consumed by this app
  transpilePackages: ['@tips/shared'],
}

module.exports = nextConfig
