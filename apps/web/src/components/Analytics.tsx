/**
 * Analytics script loader.
 *
 * Renders a Plausible Analytics script tag when NEXT_PUBLIC_PLAUSIBLE_DOMAIN
 * is configured. Supports both Plausible Cloud (default) and self-hosted
 * instances (via NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL).
 *
 * Plausible is privacy-focused, cookie-free, and GDPR-compliant by default.
 * No npm package needed — it's a single script tag.
 */

import Script from 'next/script'
import { env } from '@/env'

const PLAUSIBLE_CLOUD_SCRIPT = 'https://plausible.io/js/script.js'

export function Analytics() {
  if (!env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) return null

  const scriptUrl =
    env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL ?? PLAUSIBLE_CLOUD_SCRIPT

  return (
    <Script
      defer
      data-domain={env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
      src={scriptUrl}
      strategy="afterInteractive"
    />
  )
}
