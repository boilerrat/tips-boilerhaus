/**
 * Shared helpers for wallet-authenticated creator uploads.
 *
 * The creator UI signs a short-lived message, and the API route verifies the
 * signature server-side before allowing IPFS uploads.
 */

import type { Address } from 'viem'

export const UPLOAD_AUTH_WINDOW_MS = 5 * 60 * 1000

export const UPLOAD_AUTH_HEADERS = {
  address: 'x-tips-address',
  timestamp: 'x-tips-timestamp',
  signature: 'x-tips-signature',
} as const

interface UploadAuthPayload {
  address: Address
  timestamp: number
}

export function createUploadAuthMessage({
  address,
  timestamp,
}: UploadAuthPayload): string {
  return [
    'Authorize creator upload on tips.boilerhaus.org',
    `Address: ${address}`,
    `Timestamp: ${timestamp}`,
  ].join('\n')
}

export function buildUploadAuthHeaders({
  address,
  timestamp,
  signature,
}: UploadAuthPayload & { signature: `0x${string}` }): Record<string, string> {
  return {
    [UPLOAD_AUTH_HEADERS.address]: address,
    [UPLOAD_AUTH_HEADERS.timestamp]: String(timestamp),
    [UPLOAD_AUTH_HEADERS.signature]: signature,
  }
}
