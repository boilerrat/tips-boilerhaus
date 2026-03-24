/**
 * Supported token configuration per chain.
 *
 * ETH is represented with address: undefined (native token).
 * ERC-20 addresses are the canonical deployments on each chain.
 */

/** A token available for tipping on a given chain. */
export interface TokenConfig {
  /** Display symbol (e.g., "ETH", "USDC"). */
  symbol: string
  /** Full token name. */
  name: string
  /** Token decimals (18 for ETH/DAI, 6 for USDC). */
  decimals: number
  /** ERC-20 contract address. undefined = native ETH. */
  address: `0x${string}` | undefined
  /** Preset tip amounts in human-readable units for this token. */
  presets: readonly string[]
}

/** Native ETH — same config across all chains. */
const ETH: TokenConfig = {
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  address: undefined,
  presets: ['0.001', '0.005', '0.01', '0.05'],
}

/**
 * Supported tokens indexed by chain ID.
 *
 * Base mainnet: ETH, USDC (Circle native), DAI (bridged)
 * Base Sepolia: ETH, USDC (Circle testnet faucet)
 */
export const SUPPORTED_TOKENS: Record<number, readonly TokenConfig[]> = {
  // Base mainnet (8453)
  8453: [
    ETH,
    {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      presets: ['1', '5', '10', '25'],
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      presets: ['1', '5', '10', '25'],
    },
  ],
  // Base Sepolia testnet (84532)
  84532: [
    ETH,
    {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      presets: ['1', '5', '10', '25'],
    },
  ],
}

/** Get supported tokens for a chain. Falls back to ETH-only. */
export function getTokensForChain(chainId: number): readonly TokenConfig[] {
  return SUPPORTED_TOKENS[chainId] ?? [ETH]
}

/** Whether a token config represents native ETH. */
export function isNativeToken(token: TokenConfig): boolean {
  return token.address === undefined
}
