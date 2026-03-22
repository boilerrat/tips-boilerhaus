import { createConfig } from '@privy-io/wagmi'
import { base, baseSepolia } from 'viem/chains'
import { http } from 'wagmi'

/**
 * Wagmi configuration for use with Privy.
 *
 * Chains: Base (production) and Base Sepolia (testnet/dev).
 * Base is the primary target — low fees, Coinbase distribution, Superfluid support.
 *
 * Note: createConfig is imported from @privy-io/wagmi (not wagmi directly)
 * so that Privy can inject its connector for embedded + external wallets.
 *
 * Add additional chains here as support is expanded (e.g. Optimism, Arbitrum).
 */
export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})

/** Convenience: chain objects indexed by chain ID */
export const SUPPORTED_CHAINS = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
} as const

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS
