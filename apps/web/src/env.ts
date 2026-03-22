import { z } from 'zod'

/**
 * Environment variable schema for the web app.
 *
 * This module is imported at the top of any module that needs env vars.
 * Validation runs at startup — a missing required var throws immediately
 * rather than producing a broken runtime or silent undefined.
 *
 * All NEXT_PUBLIC_* vars are baked at build time; changes require a rebuild.
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

  NEXT_PUBLIC_BASE_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: z.string().url().optional(),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_PRIVY_APP_ID:
    process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  NEXT_PUBLIC_DEFAULT_CHAIN_ID:
    process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? '84532',
  NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS:
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS,
  NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
})

export type Env = z.infer<typeof envSchema>
