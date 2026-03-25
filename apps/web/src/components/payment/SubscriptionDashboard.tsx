/**
 * SubscriptionDashboard — Displays incoming subscriptions for a creator.
 *
 * Shows each subscription with subscriber address, token, amount/period,
 * status badge (active/overdue/cancelled), and next renewal time.
 */

'use client'

import { formatUnits } from 'viem'
import {
  useCreatorSubscriptions,
  getSubscriptionStatus,
  type SubscriptionData,
  type SubscriptionStatus,
} from '@/hooks/useSubscription'
import { getTokensForChain } from '@/lib/tokens'
import { useChainId } from 'wagmi'

interface SubscriptionDashboardProps {
  /** Creator address to show subscriptions for. */
  address: `0x${string}`
}

export function SubscriptionDashboard({ address }: SubscriptionDashboardProps) {
  const { subscriptions, isLoading } = useCreatorSubscriptions(address)
  const chainId = useChainId()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-3 h-3 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
        <p className="text-zinc-600 text-xs font-mono">Loading subscriptions...</p>
      </div>
    )
  }

  if (subscriptions.length === 0) {
    return (
      <p className="text-zinc-600 text-sm text-center py-2">
        No subscriptions yet. Share your tip page to start receiving subscribers!
      </p>
    )
  }

  // Sort: active first, then overdue, then cancelled. Most recent first within each group.
  const sorted = [...subscriptions].sort((a, b) => {
    const statusOrder: Record<SubscriptionStatus, number> = { active: 0, overdue: 1, cancelled: 2 }
    const sa = statusOrder[getSubscriptionStatus(a)]
    const sb = statusOrder[getSubscriptionStatus(b)]
    if (sa !== sb) return sa - sb
    return Number(b.startTimestamp - a.startTimestamp)
  })

  const activeCount = sorted.filter((s) => getSubscriptionStatus(s) === 'active').length

  return (
    <div className="space-y-4">
      {/* Summary */}
      {activeCount > 0 && (
        <div className="p-3 rounded-xl bg-brand-400/[0.06] border border-brand-400/20">
          <p className="text-zinc-500 text-xs mb-1">Active subscribers</p>
          <p className="text-brand-400 text-lg font-bold font-mono">{activeCount}</p>
        </div>
      )}

      {/* Subscription list */}
      <div className="space-y-2">
        {sorted.map((sub) => (
          <SubscriptionRow key={String(sub.id)} sub={sub} chainId={chainId} />
        ))}
      </div>
    </div>
  )
}

function SubscriptionRow({ sub, chainId }: { sub: SubscriptionData; chainId: number }) {
  const status = getSubscriptionStatus(sub)
  const truncatedSubscriber = `${sub.subscriber.slice(0, 6)}...${sub.subscriber.slice(-4)}`

  // Resolve token info from chain config
  const tokens = getTokensForChain(chainId)
  const tokenConfig = tokens.find(
    (t) => t.address?.toLowerCase() === sub.token.toLowerCase(),
  )
  const symbol = tokenConfig?.symbol ?? '???'
  const decimals = tokenConfig?.decimals ?? 18

  const formattedAmount = formatDisplayAmount(formatUnits(sub.amountPerPeriod, decimals))
  const periodLabel = formatPeriodLabel(sub.periodSeconds)

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
      {/* Status indicator */}
      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${
            status === 'active'
              ? 'bg-emerald-400 animate-pulse'
              : status === 'overdue'
                ? 'bg-amber-400'
                : 'bg-zinc-600'
          }`}
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-mono text-zinc-300 truncate">
            {truncatedSubscriber}
          </p>
          <StatusBadge status={status} />
        </div>
        <p className="text-xs text-zinc-500 font-mono mt-0.5">
          {formattedAmount} {symbol}/{periodLabel}
        </p>
      </div>

      {/* Next renewal */}
      <div className="text-right flex-shrink-0">
        {status === 'active' && (
          <>
            <p className="text-xs text-zinc-500">next renewal</p>
            <p className="text-xs font-mono text-zinc-400">
              {formatTimeUntilRenewal(sub.lastPaidTimestamp, sub.periodSeconds)}
            </p>
          </>
        )}
        {status === 'overdue' && (
          <p className="text-xs font-mono text-amber-400">renewal due</p>
        )}
        {status === 'cancelled' && (
          <p className="text-xs font-mono text-zinc-600">cancelled</p>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const config: Record<SubscriptionStatus, { label: string; classes: string }> = {
    active: {
      label: 'Active',
      classes: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
    },
    overdue: {
      label: 'Overdue',
      classes: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
    },
    cancelled: {
      label: 'Cancelled',
      classes: 'text-zinc-500 bg-zinc-900/40 border-zinc-800',
    },
  }

  const { label, classes } = config[status]

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${classes}`}>
      {label}
    </span>
  )
}

function formatPeriodLabel(periodSeconds: bigint): string {
  const secs = Number(periodSeconds)
  if (secs <= 604_800) return 'wk'
  if (secs <= 2_592_000) return 'mo'
  return 'yr'
}

function formatTimeUntilRenewal(lastPaidTimestamp: bigint, periodSeconds: bigint): string {
  const nextRenewal = Number(lastPaidTimestamp + periodSeconds)
  const now = Math.floor(Date.now() / 1000)
  const diff = nextRenewal - now

  if (diff <= 0) return 'now'
  if (diff < 3600) return `${Math.ceil(diff / 60)}m`
  if (diff < 86_400) return `${Math.ceil(diff / 3600)}h`
  return `${Math.ceil(diff / 86_400)}d`
}

function formatDisplayAmount(amount: string): string {
  const num = Number(amount)
  if (num === 0) return '0'
  if (num >= 1) return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return num.toPrecision(4).replace(/\.?0+$/, '')
}
