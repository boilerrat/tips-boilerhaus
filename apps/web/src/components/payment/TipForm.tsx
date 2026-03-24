/**
 * TipForm — Payment UI for sending ETH or ERC-20 tips.
 *
 * Supports:
 *   - Token selector (ETH, USDC, DAI — chain-aware)
 *   - Free-form amount input with token-specific presets
 *   - ERC-20 allowance check and approval
 *   - Optional message (stored in event log only)
 *   - Real-time transaction status feedback
 *
 * When the CreatorRegistry is deployed, tips route through the contract's
 * `tip()` function. Before deployment, only ETH direct transfers work.
 * ERC-20 tips always require the registry contract (uses transferFrom).
 */

'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  parseUnits,
  formatUnits,
  type Address,
  zeroAddress,
  erc20Abi,
  maxUint256,
} from 'viem'
import {
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useAccount,
  useChainId,
  useReadContract,
} from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { creatorRegistryAbi, REGISTRY_ADDRESS } from '@/lib/contracts'
import { getTokensForChain, isNativeToken, type TokenConfig } from '@/lib/tokens'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import type { CreatorProfile } from '@tips/shared'

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
  const chainId = useChainId()

  // --- Token selection ---
  const tokens = useMemo(() => getTokensForChain(chainId), [chainId])
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0)
  const [isCustomToken, setIsCustomToken] = useState(false)
  const [customTokenAddress, setCustomTokenAddress] = useState('')

  // Validate and parse the custom token address
  const parsedCustomAddress = useMemo((): `0x${string}` | undefined => {
    const trimmed = customTokenAddress.trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return trimmed as `0x${string}`
    return undefined
  }, [customTokenAddress])

  const { metadata: customTokenMeta, isLoading: isLoadingCustomToken } =
    useTokenMetadata(isCustomToken ? parsedCustomAddress : undefined)

  // Build the custom token config when metadata is available
  const customToken: TokenConfig | undefined = useMemo(() => {
    if (!isCustomToken || !parsedCustomAddress || !customTokenMeta) return undefined
    return {
      symbol: customTokenMeta.symbol,
      name: customTokenMeta.name,
      decimals: customTokenMeta.decimals,
      address: parsedCustomAddress,
      presets: [],
    }
  }, [isCustomToken, parsedCustomAddress, customTokenMeta])

  // tokens always has at least ETH — getTokensForChain guarantees it
  const selectedToken = isCustomToken && customToken
    ? customToken
    : (tokens[selectedTokenIndex] ?? tokens[0])!
  const isEth = isNativeToken(selectedToken)

  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')

  // Reset selection when chain changes (token list may differ)
  useEffect(() => {
    setSelectedTokenIndex(0)
    setIsCustomToken(false)
    setCustomTokenAddress('')
    setAmount('')
  }, [chainId])

  const handleTokenChange = useCallback(
    (index: number) => {
      setSelectedTokenIndex(index)
      setIsCustomToken(false)
      setAmount('')
    },
    [],
  )

  const handleCustomTokenSelect = useCallback(() => {
    setIsCustomToken(true)
    setAmount('')
  }, [])

  // ERC-20 tokens require the registry contract for transferFrom
  const canUseToken = isEth || !!REGISTRY_ADDRESS

  // Block explorer base URL
  const explorerUrl =
    chainId === 8453
      ? 'https://basescan.org'
      : 'https://sepolia.basescan.org'

  // --- Balance ---
  const { data: balance } = useBalance({
    address: senderAddress,
    token: selectedToken.address,
    query: { enabled: !!senderAddress },
  })

  // --- Amount parsing (token-aware decimals) ---
  const parsedAmount = useMemo(() => {
    try {
      const trimmed = amount.trim()
      if (!trimmed || Number(trimmed) <= 0) return undefined
      return parseUnits(trimmed, selectedToken.decimals)
    } catch {
      return undefined
    }
  }, [amount, selectedToken.decimals])

  const hasEnoughBalance = !!(
    parsedAmount &&
    balance &&
    balance.value >= parsedAmount
  )

  // --- ERC-20 allowance check ---
  const allowanceEnabled =
    !isEth && !!senderAddress && !!REGISTRY_ADDRESS && !!selectedToken.address
  const {
    data: allowance,
    refetch: refetchAllowance,
    isLoading: isAllowanceLoading,
  } = useReadContract({
    address: selectedToken.address ?? zeroAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: senderAddress && REGISTRY_ADDRESS
      ? [senderAddress, REGISTRY_ADDRESS]
      : [zeroAddress, zeroAddress],
    query: { enabled: allowanceEnabled },
  })

  const needsApproval =
    !isEth &&
    parsedAmount !== undefined &&
    !isAllowanceLoading &&
    (allowance === undefined || allowance < parsedAmount)

  // --- Approve transaction ---
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({
      hash: approveTxHash,
      confirmations: 1,
      query: {
        enabled: !!approveTxHash,
        retry: 10,
        retryDelay: 2_000,
      },
    })

  // Refetch allowance exactly once when approval transitions to confirmed
  const didRefetchAllowance = useRef(false)
  useEffect(() => {
    if (isApproveConfirmed && !didRefetchAllowance.current) {
      didRefetchAllowance.current = true
      refetchAllowance()
    }
    if (!isApproveConfirmed) {
      didRefetchAllowance.current = false
    }
  }, [isApproveConfirmed, refetchAllowance])

  const handleApprove = useCallback(() => {
    if (!selectedToken.address || !REGISTRY_ADDRESS) return
    writeApprove({
      address: selectedToken.address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [REGISTRY_ADDRESS, maxUint256],
    })
  }, [selectedToken.address, writeApprove])

  // --- Tip transaction ---
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
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    query: {
      enabled: !!txHash,
      retry: 10,
      retryDelay: 2_000,
    },
  })

  const tokenAddress = selectedToken.address

  const handleSend = useCallback(() => {
    if (!parsedAmount || !recipientAddress) return

    if (REGISTRY_ADDRESS) {
      // Route through the contract's tip() function
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: creatorRegistryAbi,
        functionName: 'tip',
        args: [
          recipientAddress,
          tokenAddress ?? zeroAddress,
          parsedAmount,
          message,
        ],
        // Only attach ETH value for native tips
        value: isEth ? parsedAmount : BigInt(0),
      })
    } else {
      // No contract deployed — direct ETH transfer only
      sendTransaction({
        to: recipientAddress,
        value: parsedAmount,
      })
    }
  }, [
    parsedAmount,
    recipientAddress,
    message,
    tokenAddress,
    isEth,
    writeContract,
    sendTransaction,
  ])

  const handleReset = useCallback(() => {
    setAmount('')
    setMessage('')
    resetContract()
    resetDirect()
    resetApprove()
  }, [resetContract, resetDirect, resetApprove])

  // --- Render ---

  const isBusy =
    isPending || isConfirming || isApprovePending || isApproveConfirming
  const receiptLost = !!receiptError && !!txHash

  // Success state (confirmed on-chain or tx sent but receipt polling timed out)
  if ((isConfirmed || receiptLost) && txHash) {
    return (
      <div className="space-y-5 text-center py-4 animate-fade-in">
        <div
          className={`inline-flex items-center justify-center w-14 h-14 rounded-full border ${
            receiptLost
              ? 'bg-amber-950/40 border-amber-800/40'
              : 'bg-emerald-950/40 border-emerald-800/40'
          }`}
        >
          {receiptLost ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-amber-400"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-white font-semibold text-lg">
            {receiptLost ? 'Tip submitted!' : 'Tip sent!'}
          </p>
          <p className="text-zinc-400 text-sm">
            {amount} {selectedToken.symbol} to {displayName}
          </p>
          {receiptLost && (
            <p className="text-amber-400/80 text-xs mt-1">
              Transaction was sent but confirmation timed out. Check the
              explorer to verify.
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
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
      {/* Token selector */}
      <div className="space-y-2.5">
        <p className="label">Token</p>
        <div className="flex flex-wrap gap-2">
          {tokens.map((token, i) => {
            const isSelected = !isCustomToken && i === selectedTokenIndex
            const disabled = !isNativeToken(token) && !REGISTRY_ADDRESS
            return (
              <button
                key={token.address ?? 'eth'}
                onClick={() => handleTokenChange(i)}
                disabled={disabled || isBusy}
                title={
                  disabled
                    ? 'ERC-20 tokens require the registry contract'
                    : token.name
                }
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
          {/* Custom token button */}
          {REGISTRY_ADDRESS && (
            <button
              onClick={handleCustomTokenSelect}
              disabled={isBusy}
              className={`px-4 py-2 text-sm font-mono rounded-lg border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                isCustomToken
                  ? 'text-brand-400 border-brand-400/30 bg-brand-400/[0.06]'
                  : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              Custom
            </button>
          )}
        </div>

        {/* Custom token address input */}
        {isCustomToken && (
          <div className="space-y-1.5">
            <input
              type="text"
              placeholder="Paste ERC-20 contract address (0x...)"
              value={customTokenAddress}
              onChange={(e) => setCustomTokenAddress(e.target.value)}
              disabled={isBusy}
              className="input-field !text-xs font-mono"
            />
            {parsedCustomAddress && isLoadingCustomToken && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
                <span className="text-zinc-500 text-xs">Fetching token info...</span>
              </div>
            )}
            {parsedCustomAddress && !isLoadingCustomToken && customToken && (
              <p className="text-emerald-400 text-xs font-mono">
                {customToken.name} ({customToken.symbol}) — {customToken.decimals} decimals
              </p>
            )}
            {parsedCustomAddress && !isLoadingCustomToken && !customToken && (
              <p className="text-red-400 text-xs">
                Could not read token metadata. Verify the address is a valid ERC-20 on this chain.
              </p>
            )}
            {customTokenAddress.trim() && !parsedCustomAddress && (
              <p className="text-zinc-600 text-xs">
                Enter a valid 0x address (42 characters).
              </p>
            )}
          </div>
        )}
      </div>

      {/* Creator tiers (if registered) — filtered by selected token */}
      {profile?.tiers &&
        profile.tiers.length > 0 &&
        (() => {
          const matchingTiers = profile.tiers.filter(
            (t) =>
              t.mode === 'tip' &&
              (isEth
                ? !t.tokenAddress
                : t.tokenAddress?.toLowerCase() ===
                  selectedToken.address?.toLowerCase()),
          )
          if (matchingTiers.length === 0) return null
          return (
            <div className="space-y-2.5">
              <p className="label">Suggested</p>
              <div className="grid grid-cols-2 gap-2">
                {matchingTiers.map((tier) => {
                  const formatted = formatUnits(
                    tier.amountWei,
                    selectedToken.decimals,
                  )
                  const isSelected = amount === formatted
                  return (
                    <button
                      key={tier.label}
                      onClick={() => setAmount(formatted)}
                      className={`px-4 py-3 border rounded-xl text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-brand-400/40 bg-brand-400/[0.06]'
                          : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/40'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-white">
                        {tier.label}
                      </span>
                      <span className="text-zinc-500 text-xs font-mono">
                        {formatted} {selectedToken.symbol}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

      {/* Amount input */}
      <div className="space-y-2.5">
        <label htmlFor="tip-amount" className="label">
          Amount ({selectedToken.symbol})
        </label>
        <input
          id="tip-amount"
          type="text"
          inputMode="decimal"
          placeholder={selectedToken.presets[0] ?? '0.01'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isBusy}
          className="input-field !text-lg font-mono"
        />
        {/* Preset buttons */}
        <div className="flex gap-2">
          {selectedToken.presets.map((preset) => {
            const isSelected = amount === preset
            return (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                disabled={isBusy}
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
          disabled={isBusy}
          maxLength={280}
          className="input-field !text-sm"
        />
      </div>

      {/* Balance display */}
      {senderAddress && balance && (
        <p className="text-xs text-zinc-600 font-mono">
          Balance:{' '}
          {Number(formatUnits(balance.value, balance.decimals)).toFixed(
            isEth ? 4 : 2,
          )}{' '}
          {selectedToken.symbol}
        </p>
      )}

      {/* Approve button — ERC-20 only, when allowance is insufficient */}
      {authenticated && needsApproval && canUseToken && (
        <>
          <button
            onClick={handleApprove}
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
              `Approve ${selectedToken.symbol}`
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

      {/* Send button */}
      {!ready ? (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
          <span className="text-zinc-600 text-sm">Loading...</span>
        </div>
      ) : !authenticated ? (
        <button onClick={login} className="btn-primary w-full">
          Connect to send tip
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={
            !parsedAmount ||
            !hasEnoughBalance ||
            isPending ||
            isConfirming ||
            needsApproval ||
            !canUseToken
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
          ) : !canUseToken ? (
            'Registry required for token tips'
          ) : !parsedAmount ? (
            'Enter an amount'
          ) : !hasEnoughBalance ? (
            'Insufficient balance'
          ) : needsApproval ? (
            `Approve ${selectedToken.symbol} first`
          ) : (
            `Send ${amount} ${selectedToken.symbol}`
          )}
        </button>
      )}

      {/* Error display */}
      {sendError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/20 border border-red-900/30">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-red-400 shrink-0 mt-0.5"
          >
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
