/**
 * Lightweight API hardening helpers for the Next.js routes.
 *
 * These utilities provide basic same-origin checks, in-memory rate limiting,
 * and creator upload signature verification.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'

import {
  createUploadAuthMessage,
  UPLOAD_AUTH_HEADERS,
  UPLOAD_AUTH_WINDOW_MS,
} from '@/lib/uploadAuth'

interface RateLimitWindow {
  count: number
  resetAt: number
}

const rateLimitBuckets = new Map<string, RateLimitWindow>()

interface RateLimitOptions {
  request: NextRequest
  key: string
  limit: number
  windowMs: number
}

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key)
    }
  }
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  return request.headers.get('x-real-ip') ?? 'unknown'
}

export function enforceSameOrigin(request: NextRequest): NextResponse | null {
  const originHeader = request.headers.get('origin')
  if (!originHeader) {
    return NextResponse.json(
      { error: 'Missing origin header.' },
      { status: 403 },
    )
  }

  const requestHost =
    request.headers.get('x-forwarded-host')
    ?? request.headers.get('host')

  if (!requestHost) {
    return NextResponse.json(
      { error: 'Missing host header.' },
      { status: 403 },
    )
  }

  let origin: URL
  try {
    origin = new URL(originHeader)
  } catch {
    return NextResponse.json(
      { error: 'Invalid origin header.' },
      { status: 403 },
    )
  }

  if (origin.host !== requestHost) {
    return NextResponse.json(
      { error: 'Origin mismatch.' },
      { status: 403 },
    )
  }

  return null
}

export function enforceRateLimit({
  request,
  key,
  limit,
  windowMs,
}: RateLimitOptions): NextResponse | null {
  const now = Date.now()
  cleanupExpiredBuckets(now)

  const bucketKey = `${key}:${getClientIp(request)}`
  const existing = rateLimitBuckets.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    })
    return null
  }

  if (existing.count >= limit) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    )
  }

  existing.count += 1
  rateLimitBuckets.set(bucketKey, existing)
  return null
}

export async function verifyUploadAuth(
  request: NextRequest,
): Promise<
  | { ok: true; address: Address }
  | { ok: false; response: NextResponse }
> {
  const addressHeader = request.headers.get(UPLOAD_AUTH_HEADERS.address)
  const timestampHeader = request.headers.get(UPLOAD_AUTH_HEADERS.timestamp)
  const signatureHeader = request.headers.get(UPLOAD_AUTH_HEADERS.signature)

  if (!addressHeader || !timestampHeader || !signatureHeader) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Missing upload authorization headers.' },
        { status: 401 },
      ),
    }
  }

  if (!isAddress(addressHeader)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid upload authorization address.' },
        { status: 401 },
      ),
    }
  }

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid upload authorization timestamp.' },
        { status: 401 },
      ),
    }
  }

  const ageMs = Math.abs(Date.now() - timestamp)
  if (ageMs > UPLOAD_AUTH_WINDOW_MS) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Upload authorization expired. Please sign again.' },
        { status: 401 },
      ),
    }
  }

  const message = createUploadAuthMessage({
    address: addressHeader,
    timestamp,
  })

  const isValid = await verifyMessage({
    address: addressHeader,
    message,
    signature: signatureHeader as `0x${string}`,
  })

  if (!isValid) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid upload authorization signature.' },
        { status: 401 },
      ),
    }
  }

  return { ok: true, address: addressHeader }
}
