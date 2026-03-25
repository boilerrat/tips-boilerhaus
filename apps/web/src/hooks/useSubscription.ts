/**
 * Hooks for managing SubscriptionManager interactions.
 *
 * - useSubscribe: create a new subscription (approve + subscribe)
 * - useSubscriptionCancel: cancel an active subscription
 * - useCreatorSubscriptions: read active subscription IDs for sender→creator
 * - useSubscriptionDetail: read a single subscription by ID
 *
 * All write hooks follow the multi-step state machine pattern
 * (idle → approving → confirming → success) established in TipForm/StreamForm.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from 'wagmi'
import { erc20Abi, maxUint256, zeroAddress } from 'viem'
import {
  subscriptionManagerAbi,
  SUBSCRIPTION_MANAGER_ADDRESS,
} from '@/lib/contracts'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** On-chain subscription struct, mapped to TypeScript. */
export interface SubscriptionData {
  readonly id: bigint
  readonly subscriber: `0x${string}`
  readonly creator: `0x${string}`
  readonly token: `0x${string}`
  readonly amountPerPeriod: bigint
  readonly periodSeconds: bigint
  readonly startTimestamp: bigint
  readonly lastPaidTimestamp: bigint
  readonly active: boolean
  readonly pendingAmount: bigint
  readonly pendingPeriod: bigint
}

// ----------------------------------------------------------------
// useSubscribe — create a new subscription
// ----------------------------------------------------------------

interface UseSubscribeResult {
  /** Trigger the subscribe transaction. Caller must have approved allowance first. */
  subscribe: (
    creator: `0x${string}`,
    token: `0x${string}`,
    amountPerPeriod: bigint,
    periodSeconds: bigint,
  ) => void
  txHash: `0x${string}` | undefined
  isPending: boolean
  isConfirming: boolean
  isConfirmed: boolean
  error: Error | null
  reset: () => void
}

export function useSubscribe(): UseSubscribeResult {
  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    query: { enabled: !!txHash, retry: 10, retryDelay: 2_000 },
  })

  const subscribe = useCallback(
    (
      creator: `0x${string}`,
      token: `0x${string}`,
      amountPerPeriod: bigint,
      periodSeconds: bigint,
    ) => {
      if (!SUBSCRIPTION_MANAGER_ADDRESS) return
      writeContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS,
        abi: subscriptionManagerAbi,
        functionName: 'subscribe',
        args: [creator, token, amountPerPeriod, periodSeconds],
      })
    },
    [writeContract],
  )

  return {
    subscribe,
    txHash,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError ?? receiptError ?? null,
    reset,
  }
}

// ----------------------------------------------------------------
// useSubscriptionCancel — cancel an active subscription
// ----------------------------------------------------------------

interface UseSubscriptionCancelResult {
  cancel: (subscriptionId: bigint) => void
  txHash: `0x${string}` | undefined
  isPending: boolean
  isConfirming: boolean
  isConfirmed: boolean
  error: Error | null
  reset: () => void
}

export function useSubscriptionCancel(): UseSubscriptionCancelResult {
  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    query: { enabled: !!txHash, retry: 10, retryDelay: 2_000 },
  })

  const cancel = useCallback(
    (subscriptionId: bigint) => {
      if (!SUBSCRIPTION_MANAGER_ADDRESS) return
      writeContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS,
        abi: subscriptionManagerAbi,
        functionName: 'cancel',
        args: [subscriptionId],
      })
    },
    [writeContract],
  )

  return {
    cancel,
    txHash,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError ?? receiptError ?? null,
    reset,
  }
}

// ----------------------------------------------------------------
// useSubscriptionAllowance — check + approve ERC-20 allowance for SubMgr
// ----------------------------------------------------------------

interface UseSubscriptionAllowanceResult {
  /** Current allowance the sender has approved for the SubscriptionManager. */
  allowance: bigint | undefined
  /** Whether allowance is still loading. */
  isLoading: boolean
  /** Whether more allowance is needed for the given amount. */
  needsApproval: boolean
  /** Send an approve(maxUint256) tx for the given token. */
  approve: () => void
  /** Whether the approve tx is awaiting wallet confirmation. */
  isApprovePending: boolean
  /** Whether we're waiting for on-chain approval confirmation. */
  isApproveConfirming: boolean
  /** Whether approval has been confirmed on-chain. */
  isApproveConfirmed: boolean
  approveError: Error | null
  resetApprove: () => void
  refetchAllowance: () => void
}

export function useSubscriptionAllowance(
  tokenAddress: `0x${string}` | undefined,
  requiredAmount: bigint | undefined,
): UseSubscriptionAllowanceResult {
  const { address: senderAddress } = useAccount()

  const enabled =
    !!senderAddress &&
    !!SUBSCRIPTION_MANAGER_ADDRESS &&
    !!tokenAddress

  const {
    data: allowance,
    isLoading,
    refetch: refetchAllowance,
  } = useReadContract({
    address: tokenAddress ?? zeroAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: senderAddress && SUBSCRIPTION_MANAGER_ADDRESS
      ? [senderAddress, SUBSCRIPTION_MANAGER_ADDRESS]
      : [zeroAddress, zeroAddress],
    query: { enabled },
  })

  const needsApproval =
    !!requiredAmount &&
    requiredAmount > 0n &&
    !isLoading &&
    (allowance === undefined || allowance < requiredAmount)

  // --- Approve tx ---
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApprovePending,
    error: approveWriteError,
    reset: resetApprove,
  } = useWriteContract()

  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveConfirmed,
    error: approveReceiptError,
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    confirmations: 1,
    query: { enabled: !!approveTxHash, retry: 10, retryDelay: 2_000 },
  })

  // Refetch allowance once when approval is confirmed
  const didRefetch = useRef(false)
  useEffect(() => {
    if (isApproveConfirmed && !didRefetch.current) {
      didRefetch.current = true
      refetchAllowance()
    }
    if (!isApproveConfirmed) {
      didRefetch.current = false
    }
  }, [isApproveConfirmed, refetchAllowance])

  const approve = useCallback(() => {
    if (!tokenAddress || !SUBSCRIPTION_MANAGER_ADDRESS) return
    writeApprove({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [SUBSCRIPTION_MANAGER_ADDRESS, maxUint256],
    })
  }, [tokenAddress, writeApprove])

  return {
    allowance,
    isLoading,
    needsApproval,
    approve,
    isApprovePending,
    isApproveConfirming,
    isApproveConfirmed,
    approveError: approveWriteError ?? approveReceiptError ?? null,
    resetApprove,
    refetchAllowance: () => refetchAllowance(),
  }
}

// ----------------------------------------------------------------
// useExistingSubscription — find active sub from sender to a creator
// ----------------------------------------------------------------

/**
 * Check if the connected wallet has an active subscription to the given creator.
 * Returns the first active subscription found (most recent), or undefined.
 */
export function useExistingSubscription(
  creatorAddress: `0x${string}` | undefined,
) {
  const { address: senderAddress } = useAccount()

  // Get all subscription IDs for the sender
  const { data: subIds } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscriptionsBySubscriber',
    args: [senderAddress!],
    query: {
      enabled: !!senderAddress && !!SUBSCRIPTION_MANAGER_ADDRESS && !!creatorAddress,
    },
  })

  // We need to read each subscription to find one matching the creator.
  // For MVP, we read up to 10 most recent IDs. In practice subscribers
  // will have very few subscriptions.
  const idsToCheck = useMemo(() => {
    if (!subIds) return []
    const ids = subIds as bigint[]
    // Take last 10 (most recent)
    return ids.slice(-10).reverse()
  }, [subIds])

  // Read first subscription (we'll chain through them)
  const { data: sub0 } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscription',
    args: [idsToCheck[0]!],
    query: { enabled: idsToCheck.length > 0 },
  })

  const { data: sub1 } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscription',
    args: [idsToCheck[1]!],
    query: { enabled: idsToCheck.length > 1 },
  })

  const { data: sub2 } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscription',
    args: [idsToCheck[2]!],
    query: { enabled: idsToCheck.length > 2 },
  })

  // Find the first active subscription to the target creator
  const activeSub = useMemo(() => {
    if (!creatorAddress) return undefined
    const candidates = [sub0, sub1, sub2].filter(Boolean) as SubscriptionData[]
    return candidates.find(
      (s) =>
        s.active &&
        s.creator.toLowerCase() === creatorAddress.toLowerCase(),
    )
  }, [sub0, sub1, sub2, creatorAddress])

  return {
    subscription: activeSub,
    hasActiveSubscription: !!activeSub,
  }
}
