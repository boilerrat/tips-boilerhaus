/**
 * StreamDashboard — Displays incoming Superfluid streams for a creator.
 *
 * Shows each active stream with sender, token, flow rate, and total streamed.
 * Also displays the aggregate flow rate across all incoming streams.
 */

'use client'

import { formatUnits } from 'viem'
import { useIncomingStreams, type SubgraphStream } from '@/hooks/useStreams'
import { formatFlowRate } from '@/lib/superfluid'

interface StreamDashboardProps {
  /** Creator address to show streams for. */
  address: `0x${string}`
}

export function StreamDashboard({ address }: StreamDashboardProps) {
  const { streams, aggregateFlowRate, isLoading, error } = useIncomingStreams(address)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-3 h-3 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
        <p className="text-zinc-600 text-xs font-mono">Loading streams...</p>
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-red-400 text-xs text-center py-2">
        Failed to load streams.
      </p>
    )
  }

  if (streams.length === 0) {
    return (
      <p className="text-zinc-600 text-sm text-center py-2">
        No active streams. Share your tip page to start receiving streams!
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Aggregate summary */}
      {aggregateFlowRate > 0n && (
        <div className="p-3 rounded-xl bg-brand-400/[0.06] border border-brand-400/20">
          <p className="text-zinc-500 text-xs mb-1">Total incoming flow</p>
          <p className="text-brand-400 text-lg font-bold font-mono">
            {formatAggregateRate(streams, aggregateFlowRate)}
          </p>
        </div>
      )}

      {/* Individual streams */}
      <div className="space-y-2">
        {streams.map((stream) => (
          <StreamRow key={stream.id} stream={stream} />
        ))}
      </div>
    </div>
  )
}

function StreamRow({ stream }: { stream: SubgraphStream }) {
  const senderAddr = stream.sender.id
  const truncatedSender = `${senderAddr.slice(0, 6)}...${senderAddr.slice(-4)}`
  const flowRate = BigInt(stream.currentFlowRate)

  // Calculate total streamed: streamedUntilUpdatedAt + (flowRate * elapsed)
  const now = BigInt(Math.floor(Date.now() / 1000))
  const lastUpdate = BigInt(stream.updatedAtTimestamp)
  const elapsed = now - lastUpdate
  const totalStreamed = BigInt(stream.streamedUntilUpdatedAt) + flowRate * elapsed

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
      {/* Streaming indicator */}
      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-mono text-zinc-300 truncate">
            {truncatedSender}
          </p>
          <span className="text-zinc-700">&#x2192;</span>
          <span className="text-xs text-zinc-500 font-mono">{stream.token.symbol}</span>
        </div>
        <p className="text-xs text-zinc-500 font-mono mt-0.5">
          {formatFlowRate(flowRate, stream.token.decimals, stream.token.symbol)}
        </p>
      </div>

      {/* Total streamed */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-mono font-medium text-white">
          {formatTotalStreamed(totalStreamed, stream.token.decimals)}
        </p>
        <p className="text-[10px] text-zinc-600">total received</p>
      </div>
    </div>
  )
}

/** Format total streamed — show reasonable precision. */
function formatTotalStreamed(weiAmount: bigint, decimals: number): string {
  const num = Number(formatUnits(weiAmount, decimals))
  if (num === 0) return '0'
  if (num >= 1) return num.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return num.toPrecision(4).replace(/\.?0+$/, '')
}

/**
 * Format the aggregate flow rate — group by token if multiple tokens
 * are being streamed.
 */
function formatAggregateRate(streams: SubgraphStream[], _total: bigint): string {
  // Group by token
  const byToken = new Map<string, { flowRate: bigint; symbol: string; decimals: number }>()
  for (const s of streams) {
    const key = s.token.id.toLowerCase()
    const existing = byToken.get(key)
    const rate = BigInt(s.currentFlowRate)
    if (existing) {
      byToken.set(key, { ...existing, flowRate: existing.flowRate + rate })
    } else {
      byToken.set(key, { flowRate: rate, symbol: s.token.symbol, decimals: s.token.decimals })
    }
  }

  return Array.from(byToken.values())
    .map((t) => formatFlowRate(t.flowRate, t.decimals, t.symbol))
    .join(' + ')
}
