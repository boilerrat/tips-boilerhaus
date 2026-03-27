/**
 * POST /api/onramp/session — Generate a Coinbase Onramp session token.
 *
 * The session token locks the destination wallet address server-side,
 * preventing client-side address substitution attacks. The token is
 * short-lived (~5 min) and single-use.
 *
 * Requires COINBASE_ONRAMP_API_KEY and COINBASE_ONRAMP_API_SECRET
 * (CDP API credentials, server-side only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, importPKCS8 } from 'jose'
import { isAddress } from 'viem'
import { z } from 'zod'
import crypto from 'crypto'

import { env } from '@/env'
import { enforceRateLimit, enforceSameOrigin } from '@/lib/apiSecurity'

const TOKEN_URL_HOST = 'api.developer.coinbase.com'
const TOKEN_URL_PATH = '/onramp/v1/token'

const requestSchema = z.object({
  walletAddress: z
    .string()
    .refine(isAddress, 'Must be a valid EVM address'),
})

/**
 * Build a CDP-authenticated JWT for the Coinbase Onramp API.
 *
 * CDP uses ES256 (ECDSA with P-256 / secp256r1) JWTs. The private key
 * is stored as a PEM string in COINBASE_ONRAMP_API_SECRET. Newlines
 * in .env files are typically escaped as literal \n — we restore them here.
 */
async function buildCdpJwt(): Promise<string> {
  const apiKeyName = env.COINBASE_ONRAMP_API_KEY!
  const rawSecret = env.COINBASE_ONRAMP_API_SECRET!

  // .env files store PEM newlines as literal \n — restore them
  const pemKey = rawSecret.replace(/\\n/g, '\n')
  const privateKey = await importPKCS8(pemKey, 'ES256')

  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    sub: apiKeyName,
    iss: 'coinbase-cloud',
    uri: `POST ${TOKEN_URL_HOST}${TOKEN_URL_PATH}`,
  })
    .setProtectedHeader({
      alg: 'ES256',
      kid: apiKeyName,
      nonce: crypto.randomBytes(16).toString('hex'),
    })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120) // 2-minute expiry
    .sign(privateKey)
}

export async function POST(request: NextRequest) {
  try {
    const originError = enforceSameOrigin(request)
    if (originError) return originError

    const rateLimitError = enforceRateLimit({
      request,
      key: 'onramp-session',
      limit: 20,
      windowMs: 5 * 60 * 1000,
    })
    if (rateLimitError) return rateLimitError

    if (!env.COINBASE_ONRAMP_API_KEY || !env.COINBASE_ONRAMP_API_SECRET) {
      return NextResponse.json(
        { error: 'Coinbase Onramp is not configured on this server.' },
        { status: 503 },
      )
    }

    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { walletAddress } = parsed.data
    const jwt = await buildCdpJwt()

    const res = await fetch(`https://${TOKEN_URL_HOST}${TOKEN_URL_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addresses: [
          {
            address: walletAddress,
            blockchains: ['base'],
          },
        ],
        assets: ['USDC'],
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[/api/onramp/session] Coinbase API error:', res.status, errorText)
      return NextResponse.json(
        { error: 'Failed to create onramp session' },
        { status: 502 },
      )
    }

    const data = await res.json()
    return NextResponse.json({ token: data.token })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    console.error('[/api/onramp/session]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
