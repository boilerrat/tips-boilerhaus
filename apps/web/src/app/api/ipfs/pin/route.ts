/**
 * POST /api/ipfs/pin — Pin creator metadata or avatar to IPFS via Pinata.
 *
 * Accepts two content types:
 *   - application/json → pins a CreatorMetadata JSON object
 *   - multipart/form-data → pins an uploaded file (avatar image)
 *
 * Returns { cid: string } on success.
 *
 * PINATA_JWT is server-side only — this route keeps it off the client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { PinataSDK } from 'pinata'
import { z } from 'zod'

import { env } from '@/env'

/** Matches the CreatorMetadata interface in packages/shared. */
const creatorMetadataSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().or(z.string().startsWith('ipfs://')).optional(),
  websiteUrl: z.string().url().optional(),
  farcasterHandle: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid Farcaster handle')
    .optional(),
})

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

function getPinata(): PinataSDK {
  if (!env.PINATA_JWT) {
    throw new Error('PINATA_JWT is not configured')
  }

  const gatewayUrl = env.NEXT_PUBLIC_PINATA_GATEWAY_URL

  return new PinataSDK({
    pinataJwt: env.PINATA_JWT,
    ...(gatewayUrl ? { pinataGateway: new URL(gatewayUrl).hostname } : {}),
  })
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      return await handleJsonPin(request)
    }

    if (contentType.includes('multipart/form-data')) {
      return await handleFilePin(request)
    }

    return NextResponse.json(
      { error: 'Unsupported content type. Use application/json or multipart/form-data.' },
      { status: 415 },
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'

    if (message === 'PINATA_JWT is not configured') {
      return NextResponse.json(
        { error: 'IPFS pinning is not configured on this server.' },
        { status: 503 },
      )
    }

    console.error('[/api/ipfs/pin]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Pin a CreatorMetadata JSON document. */
async function handleJsonPin(request: NextRequest) {
  const body = await request.json()
  const parsed = creatorMetadataSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid metadata', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const pinata = getPinata()
  const result = await pinata.upload.public
    .json(parsed.data)
    .name(`creator-metadata-${Date.now()}`)

  return NextResponse.json({ cid: result.cid })
}

/** Pin an uploaded file (avatar image). */
async function handleFilePin(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'Missing "file" field in form data.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      { status: 413 },
    )
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Allowed: ${allowedTypes.join(', ')}` },
      { status: 415 },
    )
  }

  const pinata = getPinata()
  const result = await pinata.upload.public
    .file(file)
    .name(`creator-avatar-${Date.now()}`)

  return NextResponse.json({ cid: result.cid })
}
