import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base, baseSepolia } from 'wagmi/chains'
import { env } from '@/env'

/**
 * Wagmi + RainbowKit configuration.
 *
 * Chains: Base (production) and Base Sepolia (testnet/dev).
 * Base is the primary target — low fees, Coinbase distribution, Superfluid support.
 *
 * Add additional chains here as support is expanded (e.g. Optimism, Arbitrum).
 */
export const wagmiConfig = getDefaultConfig({
  appName: 'Boilerhaus Tips',
  projectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [base, baseSepolia],
  ssr: true, // Required for Next.js App Router
})

/** Convenience: chain objects indexed by chain ID */
export const SUPPORTED_CHAINS = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
} as const

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS
