/**
 * SubscribeForm — UI for creating and managing recurring ERC-20 subscriptions.
 *
 * Flow:
 *   1. Select an ERC-20 token (USDC, DAI — no native ETH)
 *   2. Choose a billing period (weekly, monthly, yearly)
 *   3. Enter amount per period
 *   4. Approve ERC-20 allowance for SubscriptionManager
 *   5. Create subscription (first payment pulled immediately)
 *   6. If subscription already exists, show status + cancel option
 *
 * Follows the same multi-step state machine pattern as TipForm and StreamForm.
 */

'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { parseUnits, formatUnits, type Address } from 'viem'
import { useAccount, useBalance, useChainId } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { getTokensForChain, isNativeToken, type TokenConfig } from '@/lib/tokens'
import { SUBSCRIPTION_MANAGER_ADDRESS } from '@/lib/contracts'
import {
  useSubscribe,
  useSubscriptionCancel,
  useSubscriptionAllowance,
  useExistingSubscription,
} from '@/hooks/useSubscription'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Billing period presets in seconds. */
const PERIODS = [
  { label: 'Weekly', seconds: 604_800n, shortLabel: '/wk' },
  { label: 'Monthly', seconds: 2_592_000n, shortLabel: '/mo' },   // 30 days
  { label: 'Yearly', seconds: 31_536_000n, shortLabel: '/yr' },   // 365 days
] as const

/** Amount presets per token symbol for quick selection. */
const AMOUNT_PRESETS: Record<string, readonly string[]> = {
  USDC: ['5', '10', '25', '50'],
  DAI: ['5', '10', '25', '50'],
}

const DEFAULT_PRESETS = ['5', '10', '25', '50']

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatPeriodLabel(periodSeconds: bigint): string {
  const secs = Number(periodSeconds)
  if (secs <= 604_800) return 'week'
  if (secs <= 2_592_000) return 'month'
  return 'year'
}

function formatTimeUntilRenewal(lastPaidTimestamp: bigint, periodSeconds: bigint): string {
  const nextRenewal = Number(lastPaidTimestamp + periodSeconds)
  const now = Math.floor(Date.now() / 1000)
  const diff = nextRenewal - now

  if (diff <= 0) return 'renewal due'
  if (diff < 3600) return `${Math.ceil(diff / 60)}m`
  if (diff < 86_400) return `${Math.ceil(diff / 3600)}h`
  return `${Math.ceil(diff / 86_400)}d`
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

interface SubscribeFormProps {
  /** Resolved recipient address. */
  recipientAddress: Address
  /** Display name (ENS or truncated address). */
  displayName: string
}

export function SubscribeForm({ recipientAddress, displayName }: SubscribeFormProps) {
  const { ready, authenticated, login } = usePrivy()
  const { address: senderAddress } = useAccount()
  const chainId = useChainId()

  // --- Token selection (ERC-20 only, no native ETH) ---
  const erc20Tokens = useMemo(
    () => getTokensForChain(chainId).filter((t) => !isNativeToken(t)),
    [chainId],
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedToken = erc20Tokens[selectedIndex] ?? erc20Tokens[0]

  // Reset when chain changes
  useEffect(() => {
    setSelectedIndex(0)
    setAmount('')
    setPeriodIndex(1) // default monthly
  }, [chainId])

  // --- Period selection ---
  const [periodIndex, setPeriodIndex] = useState(1) // default monthly
  const selectedPeriod = PERIODS[periodIndex]!

  // --- Amount input ---
  const [amount, setAmount] = useState('')

  const parsedAmount = useMemo(() => {
    if (!selectedToken || !amount.trim()) return undefined
    try {
      const trimmed = amount.trim()
      if (Number(trimmed) <= 0) return undefined
      return parseUnits(trimmed, selectedToken.decimals)
    } catch {
      return undefined
    }
  }, [amount, selectedToken])

  // --- Balance check ---
  const { data: balance } = useBalance({
    address: senderAddress,
    token: selectedToken?.address,
    query: { enabled: !!senderAddress && !!selectedToken },
  })

  const hasEnoughBalance = !!(
    parsedAmount &&
    balance &&
    balance.value >= parsedAmount
  )

  // --- Existing subscription check ---
  const {
    subscription: existingSub,
    hasActiveSubscription,
  } = useExistingSubscription(recipientAddress)

  // --- Allowance ---
  const {
    needsApproval,
    approve,
    isApprovePending,
    isApproveConfirming,
    isApproveConfirmed,
    approveError,
    resetApprove,
  } = useSubscriptionAllowance(selectedToken?.address, parsedAmount)

  // --- Subscribe ---
  const {
    subscribe,
    txHash: subscribeTxHash,
    isPending: isSubscribePending,
    isConfirming: isSubscribeConfirming,
    isConfirmed: isSubscribeConfirmed,
    error: subscribeError,
    reset: resetSubscribe,
  } = useSubscribe()

  // --- Cancel ---
  const {
    cancel,
    txHash: cancelTxHash,
    isPending: isCancelPending,
    isConfirming: isCancelConfirming,
    isConfirmed: isCancelConfirmed,
    error: cancelError,
    reset: resetCancel,
  } = useSubscriptionCancel()

  const txHash = subscribeTxHash ?? cancelTxHash
  const isBusy =
    isSubscribePending || isSubscribeConfirming ||
    isCancelPending || isCancelConfirming ||
    isApprovePending || isApproveConfirming

  const explorerUrl = chainId === 8453
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org'

  // --- Handlers ---
  const handleSubscribe = useCallback(() => {
    if (!selectedToken?.address || !parsedAmount) return
    subscribe(
      recipientAddress,
      selectedToken.address,
      parsedAmount,
      selectedPeriod.seconds,
    )
  }, [selectedToken, parsedAmount, recipientAddress, selectedPeriod, subscribe])

  const handleCancel = useCallback(() => {
    if (!existingSub) return
    cancel(existingSub.id)
  }, [existingSub, cancel])

  const handleReset = useCallback(() => {
    setAmount('')
    resetSubscribe()
    resetCancel()
    resetApprove()
  }, [resetSubscribe, resetCancel, resetApprove])

  const presets = selectedToken
    ? AMOUNT_PRESETS[selectedToken.symbol] ?? DEFAULT_PRESETS
    : DEFAULT_PRESETS

  // --- No SubscriptionManager deployed ---
  if (!SUBSCRIPTION_MANAGER_ADDRESS) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-zinc-400 text-sm">
          Subscriptions are not available on this network yet.
        </p>
        <p className="text-zinc-600 text-xs">
          The subscription contract has not been deployed.
        </p>
      </div>
    )
  }

  // --- No ERC-20 tokens on this chain ---
  if (erc20Tokens.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-zinc-400 text-sm">
          No supported tokens for subscriptions on this chain.
        </p>
        <p className="text-zinc-600 text-xs">
          Switch to Base mainnet to subscribe.
        </p>
      </div>
    )
  }

  // --- Subscribe success ---
  if (isSubscribeConfirmed && subscribeTxHash) {
    return (
      <div className="space-y-5 text-center py-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-white font-semibold text-lg">Subscribed!</p>
          <p className="text-zinc-400 text-sm">
            {amount} {selectedToken?.symbol}{selectedPeriod.shortLabel} to {displayName}
          </p>
        </div>
        <a
          href={`${explorerUrl}/tx/${subscribeTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-brand-400 transition-colors font-mono"
        >
          View on Basescan
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
        <button onClick={handleReset} className="btn-secondary block mx-auto mt-2 text-sm">
          Done
        </button>
      </div>
    )
  }

  // --- Cancel success ---
  if (isCancelConfirmed && cancelTxHash) {
    return (
      <div className="space-y-5 text-center py-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-white font-semibold text-lg">Subscription cancelled</p>
          <p className="text-zinc-400 text-sm">
            No further payments will be pulled.
          </p>
        </div>
        <a
          href={`${explorerUrl}/tx/${cancelTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-brand-400 transition-colors font-mono"
        >
          View on Basescan
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
        <button onClick={handleReset} className="btn-secondary block mx-auto mt-2 text-sm">
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Existing subscription banner */}
      {hasActiveSubscription && existingSub && selectedToken && (
        <div className="p-3 rounded-xl bg-brand-400/[0.06] border border-brand-400/20 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            <span className="text-brand-400 text-xs font-medium">Active subscription</span>
          </div>
          <p className="text-zinc-300 text-sm font-mono">
            {formatUnits(existingSub.amountPerPeriod, selectedToken.decimals)} {selectedToken.symbol}
            /{formatPeriodLabel(existingSub.periodSeconds)}
          </p>
          <p className="text-zinc-600 text-xs font-mono">
            Next renewal in {formatTimeUntilRenewal(existingSub.lastPaidTimestamp, existingSub.periodSeconds)}
          </p>
          {existingSub.pendingAmount > 0n && (
            <p className="text-amber-400/80 text-xs">
              Plan change pending — takes effect at next renewal
            </p>
          )}
          <button
            onClick={handleCancel}
            disabled={isBusy}
            className="w-full py-2 px-3 mt-1 text-xs font-medium rounded-lg border border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:border-red-800/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCancelPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-red-800 border-t-red-400 rounded-full animate-spin" />
                Confirm in wallet...
              </span>
            ) : isCancelConfirming ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-red-800 border-t-red-400 rounded-full animate-spin" />
                Cancelling...
              </span>
            ) : (
              'Cancel subscription'
            )}
          </button>
        </div>
      )}

      {/* Token selector */}
      <div className="space-y-2.5">
        <p className="label">Token</p>
        <div className="flex flex-wrap gap-2">
          {erc20Tokens.map((token, i) => {
            const isSelected = i === selectedIndex
            return (
              <button
                key={token.address}
                onClick={() => {
                  setSelectedIndex(i)
                  setAmount('')
                }}
                disabled={isBusy}
                className={`px-4 py-2 text-sm font-mono rounded-lg border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'text-brand-400 border-brand-400/30 bg-brand-400/[0.06]'
                    : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {token.symbol}
              </button>
            )
          })}
        </div>
      </div>

      {/* Period selector */}
      <div className="space-y-2.5">
        <p className="label">Billing period</p>
        <div className="flex gap-2">
          {PERIODS.map((period, i) => {
            const isSelected = i === periodIndex
            return (
              <button
                key={period.label}
                onClick={() => setPeriodIndex(i)}
                disabled={isBusy}
                className={`flex-1 py-2 text-xs font-mono rounded-lg border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'text-brand-400 border-brand-400/30 bg-brand-400/[0.06]'
                    : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {period.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Amount input */}
      <div className="space-y-2.5">
        <label htmlFor="sub-amount" className="label">
          Amount per {selectedPeriod.label.toLowerCase()} ({selectedToken?.symbol})
        </label>
        <input
          id="sub-amount"
          type="text"
          inputMode="decimal"
          placeholder="10"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isBusy}
          className="input-field !text-lg font-mono"
        />
        {/* Quick presets */}
        <div className="flex gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              disabled={isBusy}
              className={`flex-1 py-2 text-xs font-mono rounded-lg transition-all duration-200 disabled:opacity-50 ${
                amount === preset
                  ? 'text-brand-400 border border-brand-400/30 bg-brand-400/[0.06]'
                  : 'text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {preset}{selectedPeriod.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Balance display */}
      {senderAddress && balance && selectedToken && (
        <p className="text-xs text-zinc-600 font-mono">
          Balance: {Number(formatUnits(balance.value, balance.decimals)).toFixed(2)} {selectedToken.symbol}
        </p>
      )}

      {/* Info callout — how subscriptions work */}
      {parsedAmount && !hasActiveSubscription && (
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
          <p className="text-zinc-400 text-xs">
            First payment is pulled immediately. Renewals happen automatically
            every {selectedPeriod.label.toLowerCase()} via a keeper.
          </p>
          <p className="text-zinc-600 text-xs">
            You can cancel anytime — no refund for the current period.
          </p>
        </div>
      )}

      {/* Approve button */}
      {authenticated && needsApproval && parsedAmount && hasEnoughBalance && (
        <>
          <button
            onClick={approve}
            disabled={isApprovePending || isApproveConfirming}
            className="btn-secondary w-full"
          >
            {isApprovePending ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                Approve in wallet...
              </span>
            ) : isApproveConfirming ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                Confirming approval...
              </span>
            ) : (
              `Approve ${selectedToken?.symbol}`
            )}
          </button>
          {approveError && (
            <p className="text-red-400 text-xs font-mono break-all">
              {approveError.message.length > 200
                ? approveError.message.slice(0, 200) + '...'
                : approveError.message}
            </p>
          )}
        </>
      )}

      {/* Subscribe / Connect button */}
      {!ready ? (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
          <span className="text-zinc-600 text-sm">Loading...</span>
        </div>
      ) : !authenticated ? (
        <button onClick={login} className="btn-primary w-full">
          Connect to subscribe
        </button>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={
            !parsedAmount ||
            !hasEnoughBalance ||
            needsApproval ||
            isSubscribePending ||
            isSubscribeConfirming ||
            isBusy
          }
          className="btn-primary w-full"
        >
          {isSubscribePending ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Confirm in wallet...
            </span>
          ) : isSubscribeConfirming ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Confirming...
            </span>
          ) : !parsedAmount ? (
            'Enter an amount'
          ) : !hasEnoughBalance ? (
            'Insufficient balance'
          ) : needsApproval ? (
            `Approve ${selectedToken?.symbol} first`
          ) : hasActiveSubscription ? (
            `Update subscription`
          ) : (
            `Subscribe ${amount} ${selectedToken?.symbol}${selectedPeriod.shortLabel}`
          )}
        </button>
      )}

      {/* Error display */}
      {(subscribeError || cancelError) && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/20 border border-red-900/30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-red-400 text-xs font-mono break-all">
            {(() => {
              const msg = (subscribeError ?? cancelError)!.message
              return msg.length > 200 ? msg.slice(0, 200) + '...' : msg
            })()}
          </p>
        </div>
      )}

      {/* Confirming indicator */}
      {(isSubscribeConfirming || isCancelConfirming) && txHash && (
        <div className="text-center space-y-1">
          <p className="text-zinc-500 text-xs font-mono">Waiting for confirmation...</p>
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 text-xs font-mono hover:text-brand-400 transition-colors"
          >
            Track on Basescan
          </a>
        </div>
      )}
    </div>
  )
}
