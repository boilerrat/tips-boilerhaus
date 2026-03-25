/**
 * Superfluid protocol configuration — contract addresses, Super Token
 * registry, subgraph endpoints, and flow rate conversion helpers.
 *
 * The CFAv1Forwarder is a canonical singleton deployed at the same address
 * on every Superfluid-supported chain. ABIs are imported from @sfpro/sdk.
 */

import { formatUnits, parseUnits } from 'viem'

// ---------------------------------------------------------------------------
// Subgraph endpoints
// ---------------------------------------------------------------------------

export const SUPERFLUID_SUBGRAPH: Record<number, string> = {
  8453: 'https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1',
  84532: 'https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1',
}

// ---------------------------------------------------------------------------
// Super Token configuration per chain
// ---------------------------------------------------------------------------

export interface SuperTokenConfig {
  /** Display symbol of the Super Token (e.g. "USDCx"). */
  symbol: string
  /** Full name. */
  name: string
  /** Decimals of the Super Token (always 18 for wrapped ERC-20 Super Tokens). */
  decimals: number
  /** Super Token contract address. */
  address: `0x${string}`
  /** Underlying ERC-20 address. undefined = native ETH wrapper (ETHx). */
  underlyingAddress: `0x${string}` | undefined
  /** Underlying token decimals (6 for USDC, 18 for ETH/DAI). */
  underlyingDecimals: number
  /** Whether this wraps native ETH (uses upgradeByETH). */
  isNativeWrapper: boolean
}

/** Super Tokens available for streaming, indexed by chain ID. */
export const SUPER_TOKENS: Record<number, readonly SuperTokenConfig[]> = {
  // Base mainnet (8453)
  8453: [
    {
      symbol: 'ETHx',
      name: 'Super ETH',
      decimals: 18,
      address: '0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93',
      underlyingAddress: undefined,
      underlyingDecimals: 18,
      isNativeWrapper: true,
    },
    {
      symbol: 'USDCx',
      name: 'Super USDC',
      decimals: 18,
      address: '0xD04383398dD2426297da660F9CCA3d439AF9ce1b',
      underlyingAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      underlyingDecimals: 6,
      isNativeWrapper: false,
    },
    {
      symbol: 'DAIx',
      name: 'Super DAI',
      decimals: 18,
      address: '0x708169c8C87563Ce904E0a7F3BFC1F3b0b767f41',
      underlyingAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      underlyingDecimals: 18,
      isNativeWrapper: false,
    },
  ],
  // Base Sepolia (84532) — use Superfluid dashboard to mint test Super Tokens
  84532: [
    {
      symbol: 'ETHx',
      name: 'Super ETH',
      decimals: 18,
      address: '0x143ea239159155B408e71CDbE836e8CFD6766732',
      underlyingAddress: undefined,
      underlyingDecimals: 18,
      isNativeWrapper: true,
    },
  ],
}

/** Get Super Tokens for a chain. Falls back to empty array. */
export function getSuperTokensForChain(chainId: number): readonly SuperTokenConfig[] {
  return SUPER_TOKENS[chainId] ?? []
}

// ---------------------------------------------------------------------------
// Flow rate helpers
// ---------------------------------------------------------------------------

const SECONDS_PER_MONTH = 2_628_000n // 30.4167 days — Superfluid convention

/**
 * Convert a monthly human-readable amount to a per-second flow rate in wei.
 * Example: monthlyToFlowRate("10", 18) => flow rate for 10 tokens/month.
 */
export function monthlyToFlowRate(monthlyAmount: string, decimals: number): bigint {
  const weiPerMonth = parseUnits(monthlyAmount, decimals)
  return weiPerMonth / SECONDS_PER_MONTH
}

/**
 * Convert a per-second flow rate (wei) to a monthly human-readable amount.
 */
export function flowRateToMonthly(flowRatePerSecond: bigint, decimals: number): string {
  const weiPerMonth = flowRatePerSecond * SECONDS_PER_MONTH
  return formatUnits(weiPerMonth, decimals)
}

/**
 * Format a flow rate as a human-friendly string like "10.50 USDCx/mo".
 */
export function formatFlowRate(
  flowRatePerSecond: bigint,
  decimals: number,
  symbol: string,
): string {
  const monthly = flowRateToMonthly(flowRatePerSecond, decimals)
  const num = Number(monthly)
  if (num === 0) return `0 ${symbol}/mo`
  const formatted = num >= 1
    ? num.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : num.toPrecision(4).replace(/\.?0+$/, '')
  return `${formatted} ${symbol}/mo`
}

/**
 * Calculate the buffer deposit required for a given flow rate.
 * Superfluid requires ~4 hours of streaming as a deposit buffer.
 */
export function estimateBufferDeposit(flowRatePerSecond: bigint): bigint {
  const BUFFER_SECONDS = 14_400n // 4 hours
  return flowRatePerSecond * BUFFER_SECONDS
}

/**
 * Format a Super Token balance for display with animated counter.
 * Shows up to 8 decimal places for the streaming effect.
 */
export function formatStreamingBalance(
  weiBalance: bigint,
  decimals = 18,
  displayDecimals = 8,
): string {
  if (weiBalance <= 0n) return '0.' + '0'.repeat(displayDecimals)
  const divisor = 10n ** BigInt(decimals)
  const whole = weiBalance / divisor
  const frac = (weiBalance < 0n ? -weiBalance : weiBalance) % divisor
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, displayDecimals)
  return `${whole}.${fracStr}`
}
