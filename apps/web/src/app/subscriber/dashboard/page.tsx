/**
 * Subscriber dashboard page.
 * Route: /subscriber/dashboard
 *
 * Shows the connected wallet's active and past subscriptions.
 * Allows cancelling active subscriptions directly from here.
 */

'use client'

import { useCallback, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { formatUnits } from 'viem'
import {
  useSubscriberSubscriptions,
  useSubscriptionCancel,
  getSubscriptionStatus,
  type SubscriptionData,
  type SubscriptionStatus,
} from '@/hooks/useSubscription'
import { getTokensForChain } from '@/lib/tokens'

export default function SubscriberDashboardPage() {
  const { ready, authenticated, login } = usePrivy()
  const { address } = useAccount()
  const chainId = useChainId()
  const {
    subscriptions,
    isLoading,
    refetch,
  } = useSubscriberSubscriptions(address)

  const activeCount = subscriptions.filter(
    (s) => getSubscriptionStatus(s) === 'active',
  ).length

  // Sort: active first, then overdue, then cancelled
  const sorted = [...subscriptions].sort((a, b) => {
    const order: Record<SubscriptionStatus, number> = { active: 0, overdue: 1, cancelled: 2 }
    const sa = order[getSubscriptionStatus(a)]
    const sb = order[getSubscriptionStatus(b)]
    if (sa !== sb) return sa - sb
    return Number(b.startTimestamp - a.startTimestamp)
  })

  return (
    <main className="relative min-h-[calc(100vh-53px)] flex flex-col items-center px-4 py-12">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-2xl w-full space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">My Subscriptions</h1>
          <p className="text-zinc-400 text-sm">
            Manage your recurring subscriptions to creators.
          </p>
        </div>

        {/* Auth gate */}
        {!ready ? (
          <LoadingCard message="Loading..." />
        ) : !authenticated ? (
          <div className="card-elevated p-6 text-center space-y-4">
            <p className="text-zinc-400 text-sm">
              Connect your wallet to view your subscriptions.
            </p>
            <button onClick={login} className="btn-primary">
              Connect wallet
            </button>
          </div>
        ) : isLoading ? (
          <LoadingCard message="Loading subscriptions..." />
        ) : subscriptions.length === 0 ? (
          <div className="card-elevated p-6 text-center space-y-2">
            <p className="text-zinc-400 text-sm">
              You don&apos;t have any subscriptions yet.
            </p>
            <p className="text-zinc-600 text-xs">
              Visit a creator&apos;s page and choose the Subscribe tab to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-brand-400/10 border-2 border-brand-400/20 flex items-center justify-center">
                  <span className="text-brand-400 text-lg font-bold font-mono">{activeCount}</span>
                </div>
                <div>
                  <p className="text-lg font-bold">
                    {activeCount} active {activeCount === 1 ? 'subscription' : 'subscriptions'}
                  </p>
                  <p className="text-zinc-500 text-sm">
                    {subscriptions.length} total
                  </p>
                </div>
              </div>
            </div>

            {/* Subscription list */}
            <div className="space-y-3">
              {sorted.map((sub) => (
                <SubscriptionCard
                  key={String(sub.id)}
                  sub={sub}
                  chainId={chainId}
                  onCancelled={refetch}
                />
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <p className="text-zinc-700 text-xs text-center font-mono">
          tips.boilerhaus.org &middot; built on Base
        </p>
      </div>
    </main>
  )
}

// ----------------------------------------------------------------
// SubscriptionCard — individual subscription with cancel action
// ----------------------------------------------------------------

function SubscriptionCard({
  sub,
  chainId,
  onCancelled,
}: {
  sub: SubscriptionData
  chainId: number
  onCancelled: () => void
}) {
  const status = getSubscriptionStatus(sub)
  const truncatedCreator = `${sub.creator.slice(0, 6)}...${sub.creator.slice(-4)}`

  const tokens = getTokensForChain(chainId)
  const tokenConfig = tokens.find(
    (t) => t.address?.toLowerCase() === sub.token.toLowerCase(),
  )
  const symbol = tokenConfig?.symbol ?? '???'
  const decimals = tokenConfig?.decimals ?? 18

  const formattedAmount = formatDisplayAmount(formatUnits(sub.amountPerPeriod, decimals))
  const periodLabel = formatPeriodLabel(sub.periodSeconds)

  const explorerUrl = chainId === 8453
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org'

  // Cancel flow
  const {
    cancel,
    txHash: cancelTxHash,
    isPending: isCancelPending,
    isConfirming: isCancelConfirming,
    isConfirmed: isCancelConfirmed,
    error: cancelError,
    reset: resetCancel,
  } = useSubscriptionCancel()

  const [showConfirm, setShowConfirm] = useState(false)

  const handleCancel = useCallback(() => {
    cancel(sub.id)
  }, [cancel, sub.id])

  // After cancel confirms, refetch parent data
  if (isCancelConfirmed && cancelTxHash) {
    return (
      <div className="card-elevated p-4 text-center space-y-3 animate-fade-in">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-sm text-white font-medium">Subscription cancelled</p>
        <a
          href={`${explorerUrl}/tx/${cancelTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-brand-400 transition-colors font-mono"
        >
          View on Basescan
        </a>
        <button
          onClick={() => {
            resetCancel()
            setShowConfirm(false)
            onCancelled()
          }}
          className="btn-secondary !text-xs !py-1.5 block mx-auto"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="card-elevated p-4 space-y-3">
      {/* Top row: creator + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              status === 'active'
                ? 'bg-emerald-400 animate-pulse'
                : status === 'overdue'
                  ? 'bg-amber-400'
                  : 'bg-zinc-600'
            }`}
          />
          <a
            href={`/pay/${sub.creator}`}
            className="text-sm font-mono text-zinc-300 hover:text-brand-400 transition-colors truncate"
          >
            {truncatedCreator}
          </a>
          <StatusBadge status={status} />
        </div>
        <p className="text-sm font-mono font-medium text-white flex-shrink-0">
          {formattedAmount} {symbol}/{periodLabel}
        </p>
      </div>

      {/* Details row */}
      <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
        <span>
          Started {formatDate(sub.startTimestamp)}
        </span>
        {status === 'active' && (
          <span>
            Renews in {formatTimeUntilRenewal(sub.lastPaidTimestamp, sub.periodSeconds)}
          </span>
        )}
        {status === 'overdue' && (
          <span className="text-amber-400">Renewal due</span>
        )}
      </div>

      {/* Pending changes */}
      {sub.pendingAmount > 0n && status === 'active' && (
        <p className="text-amber-400/80 text-xs">
          Plan change pending — takes effect at next renewal
        </p>
      )}

      {/* Cancel action */}
      {(status === 'active' || status === 'overdue') && (
        <>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full py-2 px-3 text-xs font-medium rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-900/30 hover:bg-red-950/20 transition-all duration-200"
            >
              Cancel subscription
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-zinc-400 text-xs text-center">
                Cancel this subscription? No refund for the current period.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isCancelPending || isCancelConfirming}
                  className="flex-1 py-2 text-xs font-medium rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all duration-200 disabled:opacity-50"
                >
                  Keep
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isCancelPending || isCancelConfirming}
                  className="flex-1 py-2 text-xs font-medium rounded-lg border border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:border-red-800/50 transition-all duration-200 disabled:opacity-50"
                >
                  {isCancelPending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-red-800 border-t-red-400 rounded-full animate-spin" />
                      Confirm...
                    </span>
                  ) : isCancelConfirming ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-red-800 border-t-red-400 rounded-full animate-spin" />
                      Cancelling...
                    </span>
                  ) : (
                    'Cancel'
                  )}
                </button>
              </div>
              {cancelError && (
                <p className="text-red-400 text-xs font-mono break-all">
                  {cancelError.message.length > 200
                    ? cancelError.message.slice(0, 200) + '...'
                    : cancelError.message}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------

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

function LoadingCard({ message }: { message: string }) {
  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-center gap-2 py-8">
        <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm font-mono">{message}</p>
      </div>
    </div>
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

function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDisplayAmount(amount: string): string {
  const num = Number(amount)
  if (num === 0) return '0'
  if (num >= 1) return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return num.toPrecision(4).replace(/\.?0+$/, '')
}
