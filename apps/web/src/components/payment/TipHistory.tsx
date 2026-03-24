/**
 * TipHistory — Displays recent tips for a recipient address.
 *
 * Shows a compact list of tip events with sender, amount, message,
 * and relative timestamp. Links to block explorer for verification.
 */

'use client'

import { type Address, zeroAddress } from 'viem'
import { useChainId } from 'wagmi'
import { useTipHistory, type TipEvent } from '@/hooks/useTipHistory'

interface TipHistoryProps {
  /** The address to show tip history for. */
  address: Address
  /** Maximum number of tips to display. */
  limit?: number
}

/** Format a unix timestamp as a relative time string. */
function relativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 60) return 'just now'
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins}m ago`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return `${hours}h ago`
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400)
    return `${days}d ago`
  }

  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Truncate an address to 0x1234...abcd format. */
function truncateAddress(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function TipHistory({ address, limit = 10 }: TipHistoryProps) {
  const chainId = useChainId()
  const { tips, isLoading, error } = useTipHistory(address, 'received')

  const explorerUrl = chainId === 8453
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org'

  const displayedTips = tips.slice(0, limit)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-3 h-3 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
        <p className="text-zinc-600 text-xs font-mono">Loading tips...</p>
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-zinc-600 text-xs text-center py-3">
        Could not load tip history.
      </p>
    )
  }

  if (displayedTips.length === 0) {
    return (
      <p className="text-zinc-600 text-xs text-center py-3">
        No tips yet. Be the first!
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {displayedTips.map((tip) => (
        <TipRow key={tip.txHash} tip={tip} explorerUrl={explorerUrl} />
      ))}
    </div>
  )
}

function TipRow({ tip, explorerUrl }: { tip: TipEvent; explorerUrl: string }) {
  return (
    <a
      href={`${explorerUrl}/tx/${tip.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/40 transition-colors group"
    >
      {/* Token icon placeholder */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
        <span className="text-xs font-mono font-medium text-zinc-400">
          {tip.tokenAddress === zeroAddress ? 'Ξ' : tip.tokenSymbol.slice(0, 2)}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-mono text-zinc-300 truncate">
            {truncateAddress(tip.sender)}
          </span>
          <span className="flex-shrink-0 text-sm font-mono font-medium text-white">
            {formatTipAmount(tip.amountFormatted)} {tip.tokenSymbol}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-0.5">
          {tip.message ? (
            <p className="text-xs text-zinc-500 truncate">{tip.message}</p>
          ) : (
            <span />
          )}
          <span className="flex-shrink-0 text-xs text-zinc-600 font-mono">
            {relativeTime(tip.timestamp)}
          </span>
        </div>
      </div>

      {/* External link indicator — hidden on mobile to save space */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden sm:block flex-shrink-0 text-zinc-700 group-hover:text-zinc-500 transition-colors"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  )
}

/** Format a tip amount — trim trailing zeros but keep reasonable precision. */
function formatTipAmount(amount: string): string {
  const num = Number(amount)
  if (num === 0) return '0'
  if (num >= 1) return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
  // Small amounts: show up to 6 significant digits
  return num.toPrecision(4).replace(/\.?0+$/, '')
}
