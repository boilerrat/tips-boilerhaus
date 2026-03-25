import { z } from 'zod'

/**
 * Environment variable schema for the web app.
 *
 * This module is imported at the top of any module that needs env vars.
 *
 * All NEXT_PUBLIC_* vars are baked at build time; changes require a rebuild.
 *
 * Uses safeParse so the build doesn't crash during Next.js static page
 * generation — env vars are only strictly required at runtime in the browser.
 */
const envSchema = z.object({
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1, 'Privy app ID is required'),

  NEXT_PUBLIC_DEFAULT_CHAIN_ID: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default('84532'), // Base Sepolia default for dev

  // Set after contract deploy — optional during initial development
  NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM address')
    .optional(),

  // SubscriptionManager contract address (set after deploy)
  NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM address')
    .optional(),

  NEXT_PUBLIC_BASE_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: z.string().url().optional(),

  // Pinata IPFS pinning — required for creator metadata uploads
  PINATA_JWT: z.string().min(1).optional(),
  NEXT_PUBLIC_PINATA_GATEWAY_URL: z
    .string()
    .url()
    .optional(), // e.g. https://mygateway.mypinata.cloud

  // Coinbase Onramp — server-side only, for generating session tokens
  COINBASE_ONRAMP_API_KEY: z.string().min(1).optional(),
  COINBASE_ONRAMP_API_SECRET: z.string().min(1).optional(),
})

const raw = {
  NEXT_PUBLIC_PRIVY_APP_ID:
    process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  NEXT_PUBLIC_DEFAULT_CHAIN_ID:
    process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? '84532',
  NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS:
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS,
  NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS:
    process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS,
  NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  PINATA_JWT: process.env.PINATA_JWT,
  NEXT_PUBLIC_PINATA_GATEWAY_URL: process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL,
  COINBASE_ONRAMP_API_KEY: process.env.COINBASE_ONRAMP_API_KEY,
  COINBASE_ONRAMP_API_SECRET: process.env.COINBASE_ONRAMP_API_SECRET,
}

const result = envSchema.safeParse(raw)

/**
 * Validated environment variables.
 *
 * During Next.js static page generation (build-time prerendering), env vars
 * may not be available. We fall back to safe defaults so the build succeeds.
 * At runtime in the browser, the vars will be baked in by webpack.
 */
export const env: z.infer<typeof envSchema> = result.success
  ? result.data
  : {
      NEXT_PUBLIC_PRIVY_APP_ID: raw.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
      NEXT_PUBLIC_DEFAULT_CHAIN_ID: 84532,
      NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS: undefined,
      NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS: undefined,
      NEXT_PUBLIC_BASE_RPC_URL: undefined,
      NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: undefined,
      PINATA_JWT: undefined,
      NEXT_PUBLIC_PINATA_GATEWAY_URL: undefined,
      COINBASE_ONRAMP_API_KEY: undefined,
      COINBASE_ONRAMP_API_SECRET: undefined,
    }

export type Env = z.infer<typeof envSchema>
