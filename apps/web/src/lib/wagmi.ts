import { createConfig } from '@privy-io/wagmi'
import { base, baseSepolia, mainnet } from 'viem/chains'
import { http } from 'wagmi'
import { env } from '@/env'

/**
 * Wagmi configuration for use with Privy.
 *
 * Chains: Base (production) and Base Sepolia (testnet/dev).
 * Base is the primary target — low fees, Coinbase distribution, Superfluid support.
 *
 * Mainnet is included solely for ENS resolution (ENS lives on L1).
 * It is not a supported transaction chain — only used for read calls.
 *
 * Note: createConfig is imported from @privy-io/wagmi (not wagmi directly)
 * so that Privy can inject its connector for embedded + external wallets.
 */
export const wagmiConfig = createConfig({
  chains: [base, baseSepolia, mainnet],
  pollingInterval: 4_000,
  transports: {
    [base.id]: http(env.NEXT_PUBLIC_BASE_RPC_URL),
    [baseSepolia.id]: http(env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
    [mainnet.id]: http(),
  },
})

/** Convenience: chain objects indexed by chain ID */
export const SUPPORTED_CHAINS = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
} as const

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS

export const DEFAULT_CHAIN_ID: SupportedChainId =
  env.NEXT_PUBLIC_DEFAULT_CHAIN_ID === base.id ? base.id : baseSepolia.id
