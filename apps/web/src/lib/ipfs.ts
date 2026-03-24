/**
 * IPFS utilities for resolving CIDs to HTTP gateway URLs.
 *
 * Pinning operations happen server-side in the /api/ipfs/pin route handler.
 * This module provides client-safe helpers for reading IPFS content.
 */

import { env } from '@/env'

const IPFS_PUBLIC_GATEWAY = 'https://ipfs.io'

/**
 * Convert an IPFS CID or ipfs:// URI to an HTTP gateway URL.
 *
 * Uses the configured Pinata dedicated gateway when available,
 * falls back to the public ipfs.io gateway.
 */
export function ipfsToHttpUrl(cidOrUri: string): string {
  const cid = cidOrUri.replace(/^ipfs:\/\//, '')

  const gateway =
    env.NEXT_PUBLIC_PINATA_GATEWAY_URL?.replace(/\/+$/, '') ?? IPFS_PUBLIC_GATEWAY

  return `${gateway}/ipfs/${cid}`
}

/**
 * Check whether a string looks like an IPFS CID or ipfs:// URI.
 */
export function isIpfsUri(value: string): boolean {
  return (
    value.startsWith('ipfs://') ||
    value.startsWith('Qm') ||
    value.startsWith('bafy')
  )
}
