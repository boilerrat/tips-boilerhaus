/**
 * TipForm — Phase 1 payment UI for sending ETH tips.
 *
 * Supports:
 *   - Free-form ETH amount input
 *   - Quick-select preset amounts
 *   - Optional message (stored in event log only)
 *   - Real-time transaction status feedback
 *
 * When the CreatorRegistry is deployed, tips route through the contract's
 * `tip()` function. Before deployment, tips are sent as direct ETH transfers.
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { parseEther, formatEther, type Address, zeroAddress } from 'viem'
import {
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useAccount,
} from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { creatorRegistryAbi, REGISTRY_ADDRESS } from '@/lib/contracts'
import type { CreatorProfile } from '@tips/shared'

/** Preset tip amounts in ETH. */
const PRESETS = ['0.001', '0.005', '0.01', '0.05'] as const

interface TipFormProps {
  /** Resolved recipient address. */
  recipientAddress: Address
  /** Display name (ENS or truncated address). */
  displayName: string
  /** Creator profile from registry, if registered. */
  profile?: CreatorProfile | undefined
}

export function TipForm({ recipientAddress, displayName, profile }: TipFormProps) {
  const { ready, authenticated, login } = usePrivy()
  const { address: senderAddress } = useAccount()

  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')

  // Sender's ETH balance for validation
  const { data: balance } = useBalance({
    address: senderAddress,
    query: { enabled: !!senderAddress },
  })

  // Parse the input amount
  const parsedAmount = useMemo(() => {
    try {
      const trimmed = amount.trim()
      if (!trimmed || Number(trimmed) <= 0) return undefined
      return parseEther(trimmed)
    } catch {
      return undefined
    }
  }, [amount])

  const hasEnoughBalance = !!(
    parsedAmount &&
    balance &&
    balance.value >= parsedAmount
  )

  // --- Transaction: via registry contract if deployed, direct transfer otherwise ---

  const {
    writeContract,
    data: contractTxHash,
    isPending: isContractPending,
    error: contractError,
    reset: resetContract,
  } = useWriteContract()

  const {
    sendTransaction,
    data: directTxHash,
    isPending: isDirectPending,
    error: directError,
    reset: resetDirect,
  } = useSendTransaction()

  const txHash = contractTxHash ?? directTxHash
  const isPending = isContractPending || isDirectPending
  const sendError = contractError ?? directError

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash: txHash })

  const handleSend = useCallback(() => {
    if (!parsedAmount || !recipientAddress) return

    if (REGISTRY_ADDRESS) {
      // Route through the contract's tip() function
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: creatorRegistryAbi,
        functionName: 'tip',
        args: [recipientAddress, zeroAddress, parsedAmount, message],
        value: parsedAmount,
      })
    } else {
      // No contract deployed yet — direct ETH transfer
      sendTransaction({
        to: recipientAddress,
        value: parsedAmount,
      })
    }
  }, [parsedAmount, recipientAddress, message, writeContract, sendTransaction])

  const handleReset = useCallback(() => {
    setAmount('')
    setMessage('')
    resetContract()
    resetDirect()
  }, [resetContract, resetDirect])

  // --- Render ---

  // Success state
  if (isConfirmed && txHash) {
    return (
      <div className="space-y-5 text-center py-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-white font-semibold text-lg">Tip sent!</p>
          <p className="text-zinc-400 text-sm">
            {amount} ETH to {displayName}
          </p>
        </div>
        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
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
        <button
          onClick={handleReset}
          className="btn-secondary block mx-auto mt-2 text-sm"
        >
          Send another tip
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Creator tiers (if registered) */}
      {profile?.tiers && profile.tiers.length > 0 && (
        <div className="space-y-2.5">
          <p className="label">Suggested</p>
          <div className="grid grid-cols-2 gap-2">
            {profile.tiers
              .filter((t) => t.mode === 'tip' && !t.tokenAddress)
              .map((tier) => {
                const isSelected = amount === formatEther(tier.amountWei)
                return (
                  <button
                    key={tier.label}
                    onClick={() => setAmount(formatEther(tier.amountWei))}
                    className={`px-4 py-3 border rounded-xl text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-brand-400/40 bg-brand-400/[0.06]'
                        : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/40'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-white">{tier.label}</span>
                    <span className="text-zinc-500 text-xs font-mono">
                      {formatEther(tier.amountWei)} ETH
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* Amount input */}
      <div className="space-y-2.5">
        <label htmlFor="tip-amount" className="label">
          Amount (ETH)
        </label>
        <input
          id="tip-amount"
          type="text"
          inputMode="decimal"
          placeholder="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending || isConfirming}
          className="input-field !text-lg font-mono"
        />
        {/* Preset buttons */}
        <div className="flex gap-2">
          {PRESETS.map((preset) => {
            const isSelected = amount === preset
            return (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                disabled={isPending || isConfirming}
                className={`flex-1 py-2 text-xs font-mono rounded-lg transition-all duration-200 disabled:opacity-50 ${
                  isSelected
                    ? 'text-brand-400 border border-brand-400/30 bg-brand-400/[0.06]'
                    : 'text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {preset}
              </button>
            )
          })}
        </div>
      </div>

      {/* Optional message */}
      <div className="space-y-2.5">
        <label htmlFor="tip-message" className="label">
          Message (optional)
        </label>
        <input
          id="tip-message"
          type="text"
          placeholder="Keep up the great work!"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isPending || isConfirming}
          maxLength={280}
          className="input-field !text-sm"
        />
      </div>

      {/* Balance display */}
      {senderAddress && balance && (
        <p className="text-xs text-zinc-600 font-mono">
          Balance: {Number(formatEther(balance.value)).toFixed(4)} ETH
        </p>
      )}

      {/* Send button */}
      {!ready ? (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
          <span className="text-zinc-600 text-sm">Loading...</span>
        </div>
      ) : !authenticated ? (
        <button
          onClick={login}
          className="btn-primary w-full"
        >
          Connect to send tip
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!parsedAmount || !hasEnoughBalance || isPending || isConfirming}
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
          ) : !parsedAmount ? (
            'Enter an amount'
          ) : !hasEnoughBalance ? (
            'Insufficient balance'
          ) : (
            `Send ${amount} ETH`
          )}
        </button>
      )}

      {/* Error display */}
      {sendError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/20 border border-red-900/30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-red-400 text-xs font-mono break-all">
            {sendError.message.length > 200
              ? sendError.message.slice(0, 200) + '...'
              : sendError.message}
          </p>
        </div>
      )}

      {/* Confirming indicator */}
      {isConfirming && txHash && (
        <div className="text-center space-y-1">
          <p className="text-zinc-500 text-xs font-mono">
            Waiting for confirmation...
          </p>
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
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
