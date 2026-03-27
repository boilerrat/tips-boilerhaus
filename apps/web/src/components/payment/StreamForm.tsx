/**
 * StreamForm — UI for creating, updating, and cancelling Superfluid streams.
 *
 * Flow:
 *   1. Select a Super Token (ETHx, USDCx, DAIx)
 *   2. Enter a monthly rate (converted to per-second flow rate)
 *   3. Wrap underlying tokens if needed (approve + upgrade)
 *   4. Create stream via CFAv1Forwarder.setFlowrate
 *   5. If a stream already exists, show update/cancel options
 *
 * Real-time balance animation shows the streaming effect.
 */

'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { formatUnits, type Address } from 'viem'
import { useAccount, useBalance, useChainId } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import {
  getSuperTokensForChain,
  monthlyToFlowRate,
  flowRateToMonthly,
  formatFlowRate,
  estimateBufferDeposit,
  formatStreamingBalance,
  type SuperTokenConfig,
} from '@/lib/superfluid'
import { useStreamFlow, useExistingFlowRate } from '@/hooks/useStreamFlow'
import { useWrapSuperToken } from '@/hooks/useWrapSuperToken'
import { StreamingCounter } from './StreamingCounter'

interface StreamFormProps {
  /** Resolved recipient address. */
  recipientAddress: Address
  /** Display name (ENS or truncated address). */
  displayName: string
}

export function StreamForm({ recipientAddress, displayName }: StreamFormProps) {
  const { ready, authenticated, login } = usePrivy()
  const { address: senderAddress } = useAccount()
  const chainId = useChainId()

  // --- Super Token selection ---
  const superTokens = useMemo(() => getSuperTokensForChain(chainId), [chainId])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedToken = superTokens[selectedIndex] ?? superTokens[0]

  // Reset selection when chain changes
  useEffect(() => {
    setSelectedIndex(0)
    setMonthlyAmount('')
  }, [chainId])

  // --- Flow rate input ---
  const [monthlyAmount, setMonthlyAmount] = useState('')

  const flowRatePerSecond = useMemo(() => {
    if (!monthlyAmount.trim() || !selectedToken) return 0n
    try {
      return monthlyToFlowRate(monthlyAmount, selectedToken.decimals)
    } catch {
      return 0n
    }
  }, [monthlyAmount, selectedToken])

  const bufferDeposit = useMemo(
    () => estimateBufferDeposit(flowRatePerSecond),
    [flowRatePerSecond],
  )

  // --- Existing stream check ---
  const { flowRate: existingFlowRate, hasExistingStream } = useExistingFlowRate(
    selectedToken?.address,
    recipientAddress,
  )

  // --- Super Token balance ---
  const { data: superBalance } = useBalance({
    address: senderAddress,
    token: selectedToken?.address,
    query: { enabled: !!senderAddress && !!selectedToken },
  })

  // Check if user has enough Super Tokens for buffer + some streaming time
  const requiredAmount = flowRatePerSecond > 0n
    ? bufferDeposit + flowRatePerSecond * 3600n // buffer + 1 hour minimum
    : 0n

  const hasEnoughSuperTokens = !!(
    superBalance &&
    superBalance.value >= requiredAmount &&
    flowRatePerSecond > 0n
  )

  // --- Wrapping ---
  const [showWrapUI, setShowWrapUI] = useState(false)
  const [wrapAmount, setWrapAmount] = useState('')

  const {
    step: wrapStep,
    needsApproval: wrapNeedsApproval,
    approve: wrapApprove,
    wrap,
    wrapETH,
    superBalance: wrappedBalance,
    underlyingBalance,
    error: wrapError,
    reset: resetWrap,
    isPending: isWrapPending,
  } = useWrapSuperToken(selectedToken, wrapAmount)

  const handleWrap = useCallback(() => {
    if (!selectedToken || !wrapAmount.trim()) return
    if (selectedToken.isNativeWrapper) {
      wrapETH(wrapAmount)
    } else {
      wrap(wrapAmount)
    }
  }, [selectedToken, wrapAmount, wrap, wrapETH])

  // --- Stream transaction ---
  const {
    setFlowrate,
    txHash,
    isPending,
    isConfirming,
    isConfirmed,
    error: streamError,
    reset: resetStream,
  } = useStreamFlow()

  const handleCreateOrUpdate = useCallback(() => {
    if (!selectedToken || flowRatePerSecond <= 0n) return
    setFlowrate(selectedToken.address, recipientAddress, flowRatePerSecond)
  }, [selectedToken, flowRatePerSecond, recipientAddress, setFlowrate])

  const handleCancel = useCallback(() => {
    if (!selectedToken) return
    setFlowrate(selectedToken.address, recipientAddress, 0n)
  }, [selectedToken, recipientAddress, setFlowrate])

  const handleReset = useCallback(() => {
    setMonthlyAmount('')
    resetStream()
    resetWrap()
    setShowWrapUI(false)
    setWrapAmount('')
  }, [resetStream, resetWrap])

  // Block explorer
  const explorerUrl = chainId === 8453
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org'

  const isBusy = isPending || isConfirming || isWrapPending

  // --- No Super Tokens on this chain ---
  if (superTokens.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-zinc-400 text-sm">
          Superfluid streaming is not available on this chain yet.
        </p>
        <p className="text-zinc-600 text-xs">
          Switch to Base mainnet to use streaming.
        </p>
      </div>
    )
  }

  // --- Success state ---
  if (isConfirmed && txHash) {
    const isCancel = flowRatePerSecond === 0n || monthlyAmount === ''
    return (
      <div className="space-y-5 text-center py-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-white font-semibold text-lg">
            {isCancel ? 'Stream cancelled!' : hasExistingStream ? 'Stream updated!' : 'Stream started!'}
          </p>
          {!isCancel && (
            <p className="text-zinc-400 text-sm">
              {monthlyAmount} {selectedToken?.symbol}/mo to {displayName}
            </p>
          )}
        </div>
        <a
          href={`${explorerUrl}/tx/${txHash}`}
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
          {isCancel ? 'Done' : 'Manage stream'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Super Token selector */}
      <div className="space-y-2.5">
        <p className="label">Super Token</p>
        <div className="flex flex-wrap gap-2">
          {superTokens.map((token, i) => {
            const isSelected = i === selectedIndex
            return (
              <button
                key={token.address}
                onClick={() => {
                  setSelectedIndex(i)
                  setMonthlyAmount('')
                  setShowWrapUI(false)
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

      {/* Existing stream info */}
      {hasExistingStream && selectedToken && (
        <div className="p-3 rounded-xl bg-brand-400/[0.06] border border-brand-400/20 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            <span className="text-brand-400 text-xs font-medium">Active stream</span>
          </div>
          <p className="text-zinc-300 text-sm font-mono">
            {formatFlowRate(existingFlowRate, selectedToken.decimals, selectedToken.symbol)}
          </p>
          {senderAddress && (
            <StreamingCounter
              superToken={selectedToken.address}
              account={senderAddress}
              netFlowRate={-existingFlowRate}
              symbol={selectedToken.symbol}
              displayDecimals={6}
            />
          )}
        </div>
      )}

      {/* Monthly rate input */}
      <div className="space-y-2.5">
        <label htmlFor="stream-rate" className="label">
          Monthly rate ({selectedToken?.symbol})
        </label>
        <input
          id="stream-rate"
          type="text"
          inputMode="decimal"
          placeholder="10"
          value={monthlyAmount}
          onChange={(e) => setMonthlyAmount(e.target.value)}
          disabled={isBusy}
          className="input-field !text-lg font-mono"
        />
        {/* Quick presets */}
        <div className="flex gap-2">
          {['1', '5', '10', '25'].map((preset) => (
            <button
              key={preset}
              onClick={() => setMonthlyAmount(preset)}
              disabled={isBusy}
              className={`flex-1 py-2 text-xs font-mono rounded-lg transition-all duration-200 disabled:opacity-50 ${
                monthlyAmount === preset
                  ? 'text-brand-400 border border-brand-400/30 bg-brand-400/[0.06]'
                  : 'text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {preset}/mo
            </button>
          ))}
        </div>
      </div>

      {/* Flow rate info */}
      {flowRatePerSecond > 0n && selectedToken && (
        <div className="space-y-1.5 text-xs text-zinc-500 font-mono">
          <p>
            Flow rate: {flowRatePerSecond.toString()} wei/sec
          </p>
          <p>
            Buffer deposit: ~{Number(formatUnits(bufferDeposit, selectedToken.decimals)).toFixed(4)} {selectedToken.symbol} (4h)
          </p>
        </div>
      )}

      {/* Super Token balance */}
      {senderAddress && selectedToken && superBalance && (
        <p className="text-xs text-zinc-600 font-mono">
          {selectedToken.symbol} balance:{' '}
          {Number(formatUnits(superBalance.value, superBalance.decimals)).toFixed(4)}
        </p>
      )}

      {/* Wrap tokens UI */}
      {authenticated && selectedToken && !hasEnoughSuperTokens && flowRatePerSecond > 0n && (
        <div className="space-y-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-sm">
              You need {selectedToken.symbol} to stream.
              {underlyingBalance !== undefined && (
                <span className="text-zinc-600 block text-xs mt-0.5">
                  {selectedToken.isNativeWrapper ? 'ETH' : selectedToken.symbol.replace('x', '')} balance:{' '}
                  {Number(formatUnits(underlyingBalance, selectedToken.underlyingDecimals)).toFixed(4)}
                </span>
              )}
            </p>
            {!showWrapUI && (
              <button
                onClick={() => setShowWrapUI(true)}
                className="btn-secondary !py-1.5 !px-3 !text-xs"
              >
                Wrap tokens
              </button>
            )}
          </div>

          {showWrapUI && (
            <div className="space-y-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder={`Amount of ${selectedToken.isNativeWrapper ? 'ETH' : selectedToken.symbol.replace('x', '')} to wrap`}
                value={wrapAmount}
                onChange={(e) => setWrapAmount(e.target.value)}
                disabled={isWrapPending}
                className="input-field !text-sm font-mono"
              />

              {wrapNeedsApproval && !selectedToken.isNativeWrapper ? (
                <button
                  onClick={wrapApprove}
                  disabled={isWrapPending}
                  className="btn-secondary w-full !text-sm"
                >
                  {isWrapPending ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                      Approving...
                    </span>
                  ) : (
                    `Approve ${selectedToken.symbol.replace('x', '')}`
                  )}
                </button>
              ) : (
                <button
                  onClick={handleWrap}
                  disabled={isWrapPending || !wrapAmount.trim()}
                  className="btn-secondary w-full !text-sm"
                >
                  {isWrapPending ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                      Wrapping...
                    </span>
                  ) : (
                    `Wrap to ${selectedToken.symbol}`
                  )}
                </button>
              )}

              {wrapStep === 'done' && (
                <p className="text-emerald-400 text-xs">
                  Tokens wrapped successfully!
                </p>
              )}

              {wrapError && (
                <p className="text-red-400 text-xs font-mono break-all">
                  {wrapError.message.length > 200
                    ? wrapError.message.slice(0, 200) + '...'
                    : wrapError.message}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!ready ? (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
          <span className="text-zinc-600 text-sm">Loading...</span>
        </div>
      ) : !authenticated ? (
        <button onClick={login} className="btn-primary w-full">
          Connect to start streaming
        </button>
      ) : (
        <div className="space-y-2">
          {/* Create / Update button */}
          <button
            onClick={handleCreateOrUpdate}
            disabled={
              flowRatePerSecond <= 0n ||
              !hasEnoughSuperTokens ||
              isPending ||
              isConfirming
            }
            className="btn-primary w-full"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Confirm in wallet...
              </span>
            ) : isConfirming ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Confirming...
              </span>
            ) : flowRatePerSecond <= 0n ? (
              'Enter a monthly rate'
            ) : !hasEnoughSuperTokens ? (
              `Wrap ${selectedToken?.symbol.replace('x', '')} first`
            ) : hasExistingStream ? (
              `Update stream to ${monthlyAmount} ${selectedToken?.symbol}/mo`
            ) : (
              `Stream ${monthlyAmount} ${selectedToken?.symbol}/mo`
            )}
          </button>

          {/* Cancel existing stream */}
          {hasExistingStream && (
            <button
              onClick={handleCancel}
              disabled={isPending || isConfirming}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-xl border border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:border-red-800/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel stream
            </button>
          )}
        </div>
      )}

      {/* Error display */}
      {streamError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/20 border border-red-900/30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-red-400 text-xs font-mono break-all">
            {streamError.message.length > 200
              ? streamError.message.slice(0, 200) + '...'
              : streamError.message}
          </p>
        </div>
      )}

      {/* Confirming indicator */}
      {isConfirming && txHash && (
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
