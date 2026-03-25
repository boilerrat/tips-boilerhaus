/**
 * StreamingCounter — Animated real-time balance display.
 *
 * Shows a Super Token balance that visually ticks up (or down) every second,
 * giving the "money streaming" effect that makes Superfluid compelling.
 */

'use client'

import { useRealtimeBalance } from '@/hooks/useRealtimeBalance'
import { formatStreamingBalance } from '@/lib/superfluid'

interface StreamingCounterProps {
  /** Super Token address to display balance for. */
  superToken: `0x${string}`
  /** Account to display balance for. */
  account: `0x${string}`
  /** Net flow rate in wei/sec (positive = incoming, negative = outgoing). */
  netFlowRate: bigint
  /** Token symbol for display (e.g. "USDCx"). */
  symbol: string
  /** Number of decimal places to show (default 8 for streaming effect). */
  displayDecimals?: number
}

export function StreamingCounter({
  superToken,
  account,
  netFlowRate,
  symbol,
  displayDecimals = 8,
}: StreamingCounterProps) {
  const { balance, isLoading } = useRealtimeBalance(superToken, account, netFlowRate)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
        <span className="text-zinc-600 text-sm font-mono">Loading balance...</span>
      </div>
    )
  }

  const formatted = formatStreamingBalance(balance, 18, displayDecimals)

  return (
    <div className="font-mono tabular-nums">
      <span className="text-xl font-bold text-white">{formatted}</span>
      <span className="text-zinc-500 text-sm ml-1.5">{symbol}</span>
    </div>
  )
}
