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
      <div className="space-y-4 text-center">
        <div className="text-2xl">&#10003;</div>
        <p className="text-zinc-300">
          Sent {amount} ETH to {displayName}
        </p>
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-zinc-500 hover:text-zinc-300 underline font-mono"
        >
          View on Basescan
        </a>
        <button
          onClick={handleReset}
          className="block mx-auto mt-4 px-6 py-2 border border-zinc-700 rounded text-sm text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
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
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Suggested</p>
          <div className="grid grid-cols-2 gap-2">
            {profile.tiers
              .filter((t) => t.mode === 'tip' && !t.tokenAddress)
              .map((tier) => (
                <button
                  key={tier.label}
                  onClick={() => setAmount(formatEther(tier.amountWei))}
                  className="px-3 py-2 border border-zinc-800 rounded text-sm hover:border-zinc-600 transition-colors text-left"
                >
                  <span className="block text-white">{tier.label}</span>
                  <span className="text-zinc-500 text-xs font-mono">
                    {formatEther(tier.amountWei)} ETH
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Amount input */}
      <div className="space-y-2">
        <label htmlFor="tip-amount" className="text-xs text-zinc-500 uppercase tracking-wide">
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
          className="w-full bg-transparent border border-zinc-800 rounded px-4 py-3 text-lg font-mono text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        />
        {/* Preset buttons */}
        <div className="flex gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              disabled={isPending || isConfirming}
              className="flex-1 py-1.5 text-xs font-mono text-zinc-500 border border-zinc-800 rounded hover:border-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Optional message */}
      <div className="space-y-2">
        <label htmlFor="tip-message" className="text-xs text-zinc-500 uppercase tracking-wide">
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
          className="w-full bg-transparent border border-zinc-800 rounded px-4 py-2 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
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
        <div className="text-center text-zinc-600 text-sm py-3">Loading...</div>
      ) : !authenticated ? (
        <button
          onClick={login}
          className="w-full py-3 bg-white text-black font-semibold rounded hover:bg-zinc-200 transition-colors"
        >
          Connect to send tip
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!parsedAmount || !hasEnoughBalance || isPending || isConfirming}
          className="w-full py-3 bg-white text-black font-semibold rounded hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending
            ? 'Confirm in wallet...'
            : isConfirming
              ? 'Confirming...'
              : !parsedAmount
                ? 'Enter an amount'
                : !hasEnoughBalance
                  ? 'Insufficient balance'
                  : `Send ${amount} ETH`}
        </button>
      )}

      {/* Error display */}
      {sendError && (
        <p className="text-red-400 text-xs font-mono break-all">
          {sendError.message.length > 200
            ? sendError.message.slice(0, 200) + '...'
            : sendError.message}
        </p>
      )}

      {/* Confirming indicator */}
      {isConfirming && (
        <p className="text-zinc-500 text-xs text-center font-mono">
          Waiting for confirmation...
        </p>
      )}
    </div>
  )
}
